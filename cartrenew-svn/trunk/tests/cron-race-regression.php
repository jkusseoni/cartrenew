<?php
/**
 * Hermetic regression coverage for cron claim and recovery races.
 *
 * Run with: php tests/cron-race-regression.php
 */

define( 'ABSPATH', __DIR__ . '/' );
define( 'HOUR_IN_SECONDS', 3600 );

ini_set( 'log_errors', '1' );
ini_set( 'error_log', '/dev/null' );

function absint( $value ) {
	return abs( (int) $value );
}

function current_time( $type ) {
	return '2026-09-22 11:20:00';
}

function get_option( $name ) {
	return 0;
}

function is_wp_error( $value ) {
	return $value instanceof WP_Error;
}

function assert_same( $expected, $actual, $message ) {
	if ( $expected !== $actual ) {
		throw new RuntimeException(
			$message . '; expected ' . var_export( $expected, true ) . ', got ' . var_export( $actual, true )
		);
	}
}

class WP_Error {
	private $message;

	public function __construct( $code, $message ) {
		$this->message = $message;
	}

	public function get_error_message() {
		return $this->message;
	}
}

class Fake_WPDB {
	public $prefix = 'wp_';
	public $row;
	public $after_select;
	public $transitions = array();

	public function reset() {
		$this->row = (object) array(
			'id'             => 1,
			'cart_key'       => 'race-cart',
			'customer_name'  => 'Test',
			'phone_number'   => '+10000000000',
			'consent'        => 1,
			'cart_contents'  => '[]',
			'cart_total'     => '10.00',
			'checkout_url'   => 'https://example.invalid/checkout',
			'status'         => 'tracking',
			'order_id'       => null,
			'last_activity'  => '2026-09-22 10:00:00',
			'created_at'     => '2026-09-22 10:00:00',
			'sent_at'        => null,
		);
		$this->after_select = null;
		$this->transitions  = array();
	}

	public function prepare( $query, ...$args ) {
		return $query;
	}

	public function get_results( $query ) {
		$results = 'tracking' === $this->row->status ? array( clone $this->row ) : array();

		if ( null !== $this->after_select ) {
			$after_select       = $this->after_select;
			$this->after_select = null;
			$after_select();
		}

		return $results;
	}

	public function update( $table, $data, $where ) {
		$matches = true;
		foreach ( $where as $key => $value ) {
			if ( $this->row->{$key} !== $value ) {
				$matches = false;
				break;
			}
		}

		$this->transitions[] = array(
			'from'    => $this->row->status,
			'to'      => $data['status'],
			'requires' => isset( $where['status'] ) ? $where['status'] : null,
			'applied' => $matches,
		);

		if ( ! $matches ) {
			return 0;
		}

		foreach ( $data as $key => $value ) {
			$this->row->{$key} = $value;
		}

		return 1;
	}
}

class CartRenew_WC_Settings {
	public static function get_settings() {
		return array(
			'enabled'         => true,
			'abandon_minutes' => 20,
		);
	}
}

class CartRenew_WC_API {
	public static $handler;

	public static function send_abandoned_cart( $cart ) {
		return call_user_func( self::$handler, $cart );
	}
}

$wpdb = new Fake_WPDB();
$wpdb->reset();

require_once __DIR__ . '/../includes/class-cr-db.php';
require_once __DIR__ . '/../includes/class-cr-cron.php';

$tests = array(
	'overlap dispatches once' => function () use ( $wpdb ) {
		$wpdb->reset();
		$sends = 0;

		CartRenew_WC_API::$handler = function () use ( &$sends ) {
			++$sends;
			return true;
		};
		$wpdb->after_select       = function () {
			CartRenew_WC_Cron::run();
		};

		CartRenew_WC_Cron::run();

		assert_same( 1, $sends, 'overlapping sweeps must dispatch only once' );
		assert_same( 'sent', $wpdb->row->status, 'successful claimed cart must finish sent' );
		assert_same( false, $wpdb->transitions[2]['applied'], 'stale sweep claim must fail' );
	},

	'recovery before claim skips dispatch' => function () use ( $wpdb ) {
		$wpdb->reset();
		$sends = 0;

		CartRenew_WC_API::$handler = function () use ( &$sends ) {
			++$sends;
			return true;
		};
		$wpdb->after_select       = function () {
			CartRenew_WC_DB::mark_status( 'race-cart', 'recovered', array( 'order_id' => 101 ) );
		};

		CartRenew_WC_Cron::run();

		assert_same( 0, $sends, 'cart recovered after selection must not dispatch' );
		assert_same( 'recovered', $wpdb->row->status, 'recovery before claim must be preserved' );
		assert_same( false, $wpdb->transitions[1]['applied'], 'claim after recovery must fail' );
	},

	'recovery during successful send is preserved' => function () use ( $wpdb ) {
		$wpdb->reset();
		$sends = 0;

		CartRenew_WC_API::$handler = function () use ( &$sends, $wpdb ) {
			++$sends;
			assert_same( 'pending_send', $wpdb->row->status, 'cart must be claimed before dispatch' );
			CartRenew_WC_DB::mark_status( 'race-cart', 'recovered', array( 'order_id' => 102 ) );
			return true;
		};

		CartRenew_WC_Cron::run();

		assert_same( 1, $sends, 'claimed cart should dispatch once' );
		assert_same( 'recovered', $wpdb->row->status, 'successful send must not overwrite recovery' );
		assert_same( false, $wpdb->transitions[2]['applied'], 'sent transition after recovery must fail' );
	},

	'recovery during failed send is preserved' => function () use ( $wpdb ) {
		$wpdb->reset();
		$sends = 0;

		CartRenew_WC_API::$handler = function () use ( &$sends, $wpdb ) {
			++$sends;
			assert_same( 'pending_send', $wpdb->row->status, 'cart must be claimed before dispatch' );
			CartRenew_WC_DB::mark_status( 'race-cart', 'recovered', array( 'order_id' => 103 ) );
			return new WP_Error( 'forced_failure', 'Hermetic forced failure' );
		};

		CartRenew_WC_Cron::run();

		assert_same( 1, $sends, 'claimed cart should attempt dispatch once' );
		assert_same( 'recovered', $wpdb->row->status, 'failed send must not overwrite recovery' );
		assert_same( false, $wpdb->transitions[2]['applied'], 'send_failed transition after recovery must fail' );
	},
);

$failures = 0;
foreach ( $tests as $name => $test ) {
	try {
		$test();
		echo "PASS: {$name}\n";
	} catch ( Throwable $error ) {
		++$failures;
		fwrite( STDERR, "FAIL: {$name}: {$error->getMessage()}\n" );
	}
}

exit( 0 === $failures ? 0 : 1 );
