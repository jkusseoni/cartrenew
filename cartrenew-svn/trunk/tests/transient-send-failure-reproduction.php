<?php
/**
 * Hermetic regression coverage for retries after transient send failures.
 *
 * Run with: php tests/transient-send-failure-reproduction.php
 */

define( 'ABSPATH', __DIR__ . '/' );
define( 'HOUR_IN_SECONDS', 3600 );

ini_set( 'log_errors', '1' );
ini_set( 'error_log', '/dev/null' );

function absint( $value ) {
	return abs( (int) $value );
}

function current_time( $type ) {
	return '2026-09-24 11:00:00';
}

function get_option( $name ) {
	return 0;
}

function home_url() {
	return 'https://shop.example.invalid';
}

function trailingslashit( $value ) {
	return rtrim( $value, '/' ) . '/';
}

function wp_json_encode( $value ) {
	return json_encode( $value );
}

function is_wp_error( $value ) {
	return $value instanceof WP_Error;
}

function wp_remote_retrieve_response_code( $response ) {
	return $response['response']['code'];
}

function wp_remote_retrieve_body( $response ) {
	return $response['body'];
}

function assert_same( $expected, $actual, $message ) {
	if ( $expected !== $actual ) {
		throw new RuntimeException(
			$message . '; expected ' . var_export( $expected, true ) . ', got ' . var_export( $actual, true )
		);
	}
}

class WP_Error {
	private $code;
	private $message;
	private $data;

	public function __construct( $code, $message, $data = null ) {
		$this->code    = $code;
		$this->message = $message;
		$this->data    = $data;
	}

	public function get_error_code() {
		return $this->code;
	}

	public function get_error_message() {
		return $this->message;
	}

	public function get_error_data() {
		return $this->data;
	}
}

class Fake_WPDB {
	public $prefix = 'wp_';
	public $row;
	public $transitions = array();

	public function __construct() {
		$this->reset();
	}

	public function reset() {
		$this->row = (object) array(
			'id'             => 1,
			'cart_key'       => 'hermetic-cart',
			'customer_name'  => 'Test Shopper',
			'phone_number'   => '+10000000000',
			'consent'        => 1,
			'cart_contents'  => '[]',
			'cart_total'     => '25.00',
			'checkout_url'   => 'https://shop.example.invalid/checkout',
			'status'         => 'tracking',
			'order_id'       => null,
			'last_activity'  => '2026-09-24 10:00:00',
			'created_at'     => '2026-09-24 10:00:00',
			'sent_at'        => null,
		);
		$this->transitions = array();
	}

	public function prepare( $query, ...$args ) {
		return $query;
	}

	public function get_results( $query ) {
		return 'tracking' === $this->row->status ? array( clone $this->row ) : array();
	}

	public function update( $table, $data, $where ) {
		foreach ( $where as $key => $value ) {
			if ( $this->row->{$key} !== $value ) {
				return 0;
			}
		}

		$this->transitions[] = array(
			'from' => $this->row->status,
			'to'   => $data['status'],
		);

		foreach ( $data as $key => $value ) {
			$this->row->{$key} = $value;
		}

		return 1;
	}
}

class CartRenew_WC_Settings {
	public static $settings = array(
		'enabled'         => true,
		'abandon_minutes' => 20,
		'store_id'        => 'hermetic-store',
		'api_key'         => 'not-a-real-secret',
		'api_base'        => 'https://api.example.invalid/api/woocommerce/',
	);

	public static function get_settings() {
		return self::$settings;
	}
}

$http_requests           = 0;
$backend_insert_attempts = 0;
$http_responses          = array();

function wp_remote_post( $endpoint, $args ) {
	global $http_requests, $http_responses;
	++$http_requests;

	if ( empty( $http_responses ) ) {
		throw new RuntimeException( 'No hermetic HTTP response queued.' );
	}

	return array_shift( $http_responses );
}

$wpdb = new Fake_WPDB();

$source_root = isset( $argv[1] ) ? realpath( $argv[1] ) : realpath( __DIR__ . '/..' );
if ( ! $source_root || ! is_file( $source_root . '/includes/class-cr-cron.php' ) ) {
	throw new RuntimeException( 'Pass the plugin source root containing includes/class-cr-cron.php.' );
}

require_once $source_root . '/includes/class-cr-db.php';
require_once $source_root . '/includes/class-cr-api.php';
require_once $source_root . '/includes/class-cr-cron.php';

function response_with_code( $code ) {
	return array(
		'response' => array( 'code' => $code ),
		'body'     => 500 === $code ? '{"error":"transient upstream failure"}' : '{}',
	);
}

function reset_scenario() {
	global $wpdb, $http_requests, $http_responses;
	$wpdb->reset();
	$http_requests  = 0;
	$http_responses = array();
	CartRenew_WC_Settings::$settings['api_key'] = 'not-a-real-secret';
}

$tests = array(
	'HTTP 500 retries on the next sweep' => function () {
		global $wpdb, $http_requests, $http_responses, $backend_insert_attempts;
		reset_scenario();
		$http_responses = array( response_with_code( 500 ), response_with_code( 200 ) );

		CartRenew_WC_Cron::run();
		assert_same( 1, $http_requests, 'first sweep must attempt one HTTP request' );
		assert_same( 0, $backend_insert_attempts, 'simulated failure occurs before backend insert' );
		assert_same( 'tracking', $wpdb->row->status, 'transient HTTP 500 must remain retryable' );
		assert_same( null, $wpdb->row->sent_at, 'retryable failure must not set sent_at' );

		CartRenew_WC_Cron::run();
		assert_same( 2, $http_requests, 'second sweep must retry the request' );
		assert_same( 'sent', $wpdb->row->status, 'successful retry must finish sent' );
	},
	'transport failure retries on the next sweep' => function () {
		global $wpdb, $http_requests, $http_responses;
		reset_scenario();
		$http_responses = array(
			new WP_Error( 'http_request_failed', 'Connection timed out.' ),
			response_with_code( 200 ),
		);

		CartRenew_WC_Cron::run();
		assert_same( 'tracking', $wpdb->row->status, 'transport error must remain retryable' );
		CartRenew_WC_Cron::run();
		assert_same( 2, $http_requests, 'transport error must be retried' );
		assert_same( 'sent', $wpdb->row->status, 'successful transport retry must finish sent' );
	},
	'HTTP 400 remains terminal' => function () {
		global $wpdb, $http_requests, $http_responses;
		reset_scenario();
		$http_responses = array( response_with_code( 400 ) );

		CartRenew_WC_Cron::run();
		assert_same( 'send_failed', $wpdb->row->status, 'non-retryable HTTP 400 must be terminal' );
		CartRenew_WC_Cron::run();
		assert_same( 1, $http_requests, 'terminal HTTP 400 must not be retried' );
	},
	'not configured remains terminal' => function () {
		global $wpdb, $http_requests;
		reset_scenario();
		CartRenew_WC_Settings::$settings['api_key'] = '';

		CartRenew_WC_Cron::run();
		assert_same( 'send_failed', $wpdb->row->status, 'configuration error must be terminal' );
		assert_same( 0, $http_requests, 'configuration error must not call the backend' );
	},
	'atomic-claim retry release preserves terminal races' => function () {
		global $wpdb;
		reset_scenario();
		$wpdb->row->status = 'pending_send';
		CartRenew_WC_DB::release_for_retry( $wpdb->row->cart_key );
		assert_same( 'tracking', $wpdb->row->status, 'pending_send claim must release for retry' );

		$wpdb->row->status = 'recovered';
		CartRenew_WC_DB::release_for_retry( $wpdb->row->cart_key );
		assert_same( 'recovered', $wpdb->row->status, 'retry release must preserve concurrent recovery' );
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

echo wp_json_encode(
	array(
		'source_root' => $source_root,
		'tests'       => count( $tests ),
		'failures'    => $failures,
	)
) . PHP_EOL;

exit( 0 === $failures ? 0 : 1 );
