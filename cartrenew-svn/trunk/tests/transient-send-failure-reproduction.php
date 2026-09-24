<?php
/**
 * Hermetic reproduction for a transient HTTP 500 before backend insertion.
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
}

class Fake_WPDB {
	public $prefix = 'wp_';
	public $row;
	public $transitions = array();

	public function __construct() {
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
	public static function get_settings() {
		return array(
			'enabled'         => true,
			'abandon_minutes' => 20,
			'store_id'        => 'hermetic-store',
			'api_key'         => 'not-a-real-secret',
			'api_base'        => 'https://api.example.invalid/api/woocommerce/',
		);
	}
}

$http_requests           = 0;
$backend_insert_attempts = 0;

function wp_remote_post( $endpoint, $args ) {
	global $http_requests;
	++$http_requests;

	// Simulate a transient gateway/backend HTTP 500 before the route inserts a row.
	return array(
		'response' => array( 'code' => 500 ),
		'body'     => '{"error":"transient upstream failure"}',
	);
}

$wpdb = new Fake_WPDB();

require_once __DIR__ . '/../includes/class-cr-db.php';
require_once __DIR__ . '/../includes/class-cr-api.php';
require_once __DIR__ . '/../includes/class-cr-cron.php';

CartRenew_WC_Cron::run();

assert_same( 1, $http_requests, 'first sweep must attempt one HTTP request' );
assert_same( 0, $backend_insert_attempts, 'simulated failure occurs before backend insert' );
assert_same( 'send_failed', $wpdb->row->status, 'transient HTTP 500 is marked terminal' );

CartRenew_WC_Cron::run();

assert_same( 1, $http_requests, 'second sweep must demonstrate that the cart is never retried' );
assert_same( 'send_failed', $wpdb->row->status, 'second sweep leaves the cart terminal' );

echo wp_json_encode(
	array(
		'http_requests'           => $http_requests,
		'backend_insert_attempts' => $backend_insert_attempts,
		'final_status'            => $wpdb->row->status,
		'transitions'             => $wpdb->transitions,
	)
) . PHP_EOL;
