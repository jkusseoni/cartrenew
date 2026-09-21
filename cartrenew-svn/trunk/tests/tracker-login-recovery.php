<?php
/**
 * Hermetic regression harness for a guest cart that checks out after login.
 *
 * Run: php cartrenew-svn/trunk/tests/tracker-login-recovery.php
 */

define( 'ABSPATH', __DIR__ . '/' );

$GLOBALS['test_logged_in'] = false;
$GLOBALS['test_actions']   = array();

function add_action( $hook, $callback, $priority = 10, $accepted_args = 1 ) {
	$GLOBALS['test_actions'][ $hook ][] = array(
		'callback'      => $callback,
		'accepted_args' => $accepted_args,
	);
}

function cartrenew_test_do_action( $hook ) {
	$args = array_slice( func_get_args(), 1 );
	foreach ( $GLOBALS['test_actions'][ $hook ] ?? array() as $registered ) {
		call_user_func_array( $registered['callback'], array_slice( $args, 0, $registered['accepted_args'] ) );
	}
}

function is_user_logged_in() {
	return $GLOBALS['test_logged_in'];
}

function get_current_user_id() {
	return $GLOBALS['test_logged_in'] ? 42 : 0;
}

function wp_get_current_user() {
	return (object) array( 'display_name' => 'Test Customer' );
}

function wp_json_encode( $value ) {
	return json_encode( $value );
}

function wc_get_cart_url() {
	return 'https://example.test/cart';
}

function absint( $value ) {
	return abs( (int) $value );
}

final class CartRenew_Test_Session {
	private $customer_id = 'guest-session-123';
	private $values = array(
		'cartrenew_phone'   => '+15555550100',
		'cartrenew_consent' => 'yes',
	);

	public function get_customer_id() {
		return $this->customer_id;
	}

	public function set_customer_id( $customer_id ) {
		$this->customer_id = $customer_id;
	}

	public function get( $key, $default = null ) {
		return array_key_exists( $key, $this->values ) ? $this->values[ $key ] : $default;
	}
}

final class CartRenew_Test_Product {
	public function get_name() {
		return 'Test Product';
	}

	public function get_price() {
		return '19.99';
	}
}

final class CartRenew_Test_Cart {
	public function is_empty() {
		return false;
	}

	public function get_cart() {
		return array(
			array(
				'data'     => new CartRenew_Test_Product(),
				'quantity' => 1,
			),
		);
	}

	public function get_total( $context ) {
		return '19.99';
	}
}

$GLOBALS['test_wc'] = (object) array(
	'session' => new CartRenew_Test_Session(),
	'cart'    => new CartRenew_Test_Cart(),
);

function WC() {
	return $GLOBALS['test_wc'];
}

final class CartRenew_WC_Settings {
	public static function get_settings() {
		return array( 'enabled' => true );
	}
}

final class CartRenew_WC_DB {
	public static $rows = array();

	public static function upsert_cart( $cart_key, $data ) {
		$existing = isset( self::$rows[ $cart_key ] ) ? self::$rows[ $cart_key ] : array( 'status' => 'tracking' );
		self::$rows[ $cart_key ] = array_merge( $existing, $data );
		return count( self::$rows );
	}

	public static function migrate_cart_key( $old_cart_key, $new_cart_key ) {
		if ( isset( self::$rows[ $old_cart_key ] ) ) {
			self::$rows[ $new_cart_key ] = self::$rows[ $old_cart_key ];
			unset( self::$rows[ $old_cart_key ] );
		}
	}

	public static function mark_status( $cart_key, $status, $extra = array() ) {
		if ( isset( self::$rows[ $cart_key ] ) ) {
			self::$rows[ $cart_key ] = array_merge( self::$rows[ $cart_key ], array( 'status' => $status ), $extra );
		}
	}
}

require dirname( __DIR__ ) . '/includes/class-cr-tracker.php';

CartRenew_WC_Tracker::init();

function cartrenew_test_run_scenario( $migration_path ) {
	$GLOBALS['test_logged_in'] = false;
	$GLOBALS['test_wc']        = (object) array(
		'session' => new CartRenew_Test_Session(),
		'cart'    => new CartRenew_Test_Cart(),
	);
	CartRenew_WC_DB::$rows      = array();

	CartRenew_WC_Tracker::save_snapshot();
	$GLOBALS['test_logged_in'] = true;

	if ( 'legacy_wp_login' === $migration_path ) {
		cartrenew_test_do_action( 'wp_login', 'test-customer', (object) array( 'ID' => 42 ) );
		WC()->session->set_customer_id( '42' );
	} else {
		WC()->session->set_customer_id( '42' );
		cartrenew_test_do_action( 'woocommerce_guest_session_to_user_id', 'guest-session-123', '42' );
	}

	CartRenew_WC_Tracker::save_snapshot();
	CartRenew_WC_Tracker::mark_recovered( 9001 );

	$statuses = array();
	foreach ( CartRenew_WC_DB::$rows as $cart_key => $row ) {
		$statuses[ $cart_key ] = $row['status'];
	}

	return array(
		'statuses_after_checkout' => $statuses,
		'cron_eligible_keys'      => array_keys(
			array_filter(
				$statuses,
				static function ( $status ) {
					return 'tracking' === $status;
				}
			)
		),
	);
}

$results = array(
	'legacy_wp_login'            => cartrenew_test_run_scenario( 'legacy_wp_login' ),
	'modern_woocommerce_migrate' => cartrenew_test_run_scenario( 'modern_woocommerce_migrate' ),
);

echo json_encode( $results, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES ) . PHP_EOL;

$failures = array();
foreach ( $results as $scenario => $result ) {
	if ( array( 'user_42' => 'recovered' ) !== $result['statuses_after_checkout'] ) {
		$failures[] = $scenario . ' did not leave only the authenticated cart recovered.';
	}
	if ( $result['cron_eligible_keys'] ) {
		$failures[] = $scenario . ' left a completed cart eligible for the abandonment cron.';
	}
}

if ( $failures ) {
	fwrite( STDERR, 'FAIL: ' . implode( ' ', $failures ) . PHP_EOL );
	exit( 1 );
}

echo 'PASS: legacy and modern login migrations leave no tracked cart after checkout.' . PHP_EOL;
