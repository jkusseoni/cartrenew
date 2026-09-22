<?php
/**
 * Hermetic regression coverage for removing stale snapshots after cart emptying.
 *
 * Run with: php tests/tracker-empty-cart-regression.php
 */

define( 'ABSPATH', __DIR__ . '/' );

function add_action() {}

function current_time() {
	return '2026-09-22 11:30:00';
}

function is_user_logged_in() {
	return false;
}

function wp_json_encode( $value ) {
	return json_encode( $value );
}

function wc_get_cart_url() {
	return 'https://example.invalid/cart';
}

function assert_same( $expected, $actual, $message ) {
	if ( $expected !== $actual ) {
		throw new RuntimeException(
			$message . '; expected ' . var_export( $expected, true ) . ', got ' . var_export( $actual, true )
		);
	}
}

class Fake_WPDB {
	public $prefix = 'wp_';
	public $insert_id = 0;
	public $rows = array();

	public function prepare( $query, ...$args ) {
		return array(
			'query' => $query,
			'args'  => $args,
		);
	}

	public function get_row( $prepared ) {
		$cart_key = $prepared['args'][0];
		if ( ! isset( $this->rows[ $cart_key ] ) ) {
			return null;
		}

		return (object) array(
			'id'     => $this->rows[ $cart_key ]['id'],
			'status' => $this->rows[ $cart_key ]['status'],
		);
	}

	public function insert( $table, $data ) {
		++$this->insert_id;
		$data['id']                   = $this->insert_id;
		$this->rows[ $data['cart_key'] ] = $data;
		return 1;
	}

	public function update( $table, $data, $where ) {
		foreach ( $this->rows as $cart_key => $row ) {
			$matches = true;
			foreach ( $where as $key => $value ) {
				if ( ! array_key_exists( $key, $row ) || $row[ $key ] !== $value ) {
					$matches = false;
					break;
				}
			}

			if ( $matches ) {
				$this->rows[ $cart_key ] = array_merge( $row, $data );
				return 1;
			}
		}

		return 0;
	}

	public function delete( $table, $where ) {
		$cart_key = $where['cart_key'];
		if ( ! isset( $this->rows[ $cart_key ] ) ) {
			return 0;
		}

		unset( $this->rows[ $cart_key ] );
		return 1;
	}
}

class CartRenew_Test_Session {
	public function get_customer_id() {
		return 'guest-session-123';
	}

	public function get( $key, $default = null ) {
		$values = array(
			'cartrenew_phone'   => '+14155550100',
			'cartrenew_consent' => 'yes',
		);
		return array_key_exists( $key, $values ) ? $values[ $key ] : $default;
	}
}

class CartRenew_Test_Product {
	public function get_name() {
		return 'Test Product';
	}

	public function get_price() {
		return '19.99';
	}
}

class CartRenew_Test_Cart {
	public $empty = false;

	public function is_empty() {
		return $this->empty;
	}

	public function get_cart() {
		return array(
			array(
				'data'     => new CartRenew_Test_Product(),
				'quantity' => 1,
			),
		);
	}

	public function get_total() {
		return '19.99';
	}
}

class CartRenew_WC_Settings {
	public static function get_settings() {
		return array( 'enabled' => true );
	}
}

$wpdb = new Fake_WPDB();
$cart = new CartRenew_Test_Cart();
$GLOBALS['test_wc'] = (object) array(
	'session' => new CartRenew_Test_Session(),
	'cart'    => $cart,
);

function WC() {
	return $GLOBALS['test_wc'];
}

require_once __DIR__ . '/../includes/class-cr-db.php';
require_once __DIR__ . '/../includes/class-cr-tracker.php';

try {
	CartRenew_WC_Tracker::save_snapshot();
	assert_same( 1, count( $wpdb->rows ), 'non-empty cart must create one snapshot' );
	assert_same(
		'tracking',
		$wpdb->rows['session_guest-session-123']['status'],
		'new snapshot must be tracking'
	);

	$cart->empty = true;
	CartRenew_WC_Tracker::save_snapshot();
	assert_same( array(), $wpdb->rows, 'empty cart must remove its stale tracking snapshot' );

	$cart->empty = false;
	CartRenew_WC_Tracker::save_snapshot();
	assert_same( 1, count( $wpdb->rows ), 'adding a new item must create a fresh snapshot' );
	assert_same(
		'tracking',
		$wpdb->rows['session_guest-session-123']['status'],
		'recreated snapshot must be cron-eligible only after new activity'
	);
} catch ( Throwable $error ) {
	fwrite( STDERR, 'FAIL: ' . $error->getMessage() . PHP_EOL );
	exit( 1 );
}

echo "PASS: empty carts remove stale snapshots and later carts track normally\n";
