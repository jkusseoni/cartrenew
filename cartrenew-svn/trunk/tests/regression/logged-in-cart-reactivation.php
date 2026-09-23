<?php
/**
 * Regression coverage for reactivating logged-in carts after send/recovery.
 *
 * Run from the repository root:
 * php cartrenew-svn/trunk/tests/regression/logged-in-cart-reactivation.php
 */

define( 'ABSPATH', __DIR__ . '/' );
define( 'HOUR_IN_SECONDS', 3600 );

$test_logged_in    = true;
$test_current_user = 42;
$test_current_time = '2026-09-23 10:00:00';
$test_wc           = null;

function WC() {
	global $test_wc;
	return $test_wc;
}

function is_user_logged_in() {
	global $test_logged_in;
	return $test_logged_in;
}

function get_current_user_id() {
	global $test_current_user;
	return $test_current_user;
}

function wp_get_current_user() {
	return (object) array( 'display_name' => 'Hermetic Shopper' );
}

function wp_json_encode( $value ) {
	return json_encode( $value );
}

function wc_get_cart_url() {
	return 'https://example.invalid/cart';
}

function current_time( $type ) {
	global $test_current_time;
	return $test_current_time;
}

function get_option( $name ) {
	return 'gmt_offset' === $name ? 0 : null;
}

function absint( $value ) {
	return abs( (int) $value );
}

function is_wp_error( $value ) {
	return false;
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
	public static $send_calls = 0;

	public static function send_abandoned_cart( $cart ) {
		self::$send_calls++;
		return true;
	}
}

class Test_Session {
	private $customer_id;
	private $values;

	public function __construct( $customer_id ) {
		$this->customer_id = $customer_id;
		$this->values      = array(
			'cartrenew_phone'   => 'hermetic-phone',
			'cartrenew_consent' => 'yes',
		);
	}

	public function get_customer_id() {
		return $this->customer_id;
	}

	public function get( $key, $default = '' ) {
		return array_key_exists( $key, $this->values ) ? $this->values[ $key ] : $default;
	}
}

class Test_Product {
	private $name;
	private $price;

	public function __construct( $name, $price ) {
		$this->name  = $name;
		$this->price = $price;
	}

	public function get_name() {
		return $this->name;
	}

	public function get_price() {
		return $this->price;
	}
}

class Test_Cart {
	private $items;
	private $total;

	public function __construct( $product_name, $total ) {
		$this->items = array(
			array(
				'data'     => new Test_Product( $product_name, $total ),
				'quantity' => 1,
			),
		);
		$this->total = $total;
	}

	public function is_empty() {
		return empty( $this->items );
	}

	public function get_cart() {
		return $this->items;
	}

	public function get_total( $context ) {
		return $this->total;
	}
}

class Test_WC {
	public $session;
	public $cart;

	public function __construct( $session_id, $product_name, $total ) {
		$this->session = new Test_Session( $session_id );
		$this->cart    = new Test_Cart( $product_name, $total );
	}
}

class Test_Prepared_Query {
	public $sql;
	public $args;

	public function __construct( $sql, $args ) {
		$this->sql  = $sql;
		$this->args = $args;
	}
}

class Test_WPDB {
	public $prefix = 'wp_';
	public $insert_id;
	public $rows = array();

	public function prepare( $sql, ...$args ) {
		return new Test_Prepared_Query( $sql, $args );
	}

	public function get_row( $query ) {
		$cart_key = $query->args[0];
		foreach ( $this->rows as $row ) {
			if ( $row['cart_key'] === $cart_key ) {
				return (object) array(
					'id'     => $row['id'],
					'status' => $row['status'],
				);
			}
		}
		return null;
	}

	public function insert( $table, $data ) {
		$this->insert_id = count( $this->rows ) + 1;
		$data['id']      = $this->insert_id;
		$this->rows[]    = $data;
		return 1;
	}

	public function update( $table, $data, $where ) {
		foreach ( $this->rows as &$row ) {
			$matches = isset( $where['id'] )
				? $row['id'] === $where['id']
				: $row['cart_key'] === $where['cart_key'];
			if ( $matches ) {
				$row = array_merge( $row, $data );
				return 1;
			}
		}
		return 0;
	}

	public function get_results( $query ) {
		list( $status, $consent, $empty_phone, $cutoff, $limit ) = $query->args;
		$eligible = array_filter(
			$this->rows,
			function ( $row ) use ( $status, $consent, $empty_phone, $cutoff ) {
				return $row['status'] === $status
					&& $row['consent'] === $consent
					&& null !== $row['phone_number']
					&& $row['phone_number'] !== $empty_phone
					&& $row['last_activity'] <= $cutoff;
			}
		);
		usort(
			$eligible,
			function ( $left, $right ) {
				return strcmp( $left['last_activity'], $right['last_activity'] );
			}
		);
		return array_map( fn( $row ) => (object) $row, array_slice( $eligible, 0, $limit ) );
	}

	public function age_all_rows() {
		foreach ( $this->rows as &$row ) {
			$row['last_activity'] = '2000-01-01 00:00:00';
		}
	}

	public function reset() {
		$this->insert_id = 0;
		$this->rows      = array();
	}
}

$plugin_dir = getenv( 'CARTRENEW_TEST_PLUGIN_DIR' );
if ( ! $plugin_dir ) {
	$plugin_dir = dirname( __DIR__, 2 );
}

require_once $plugin_dir . '/includes/class-cr-db.php';
require_once $plugin_dir . '/includes/class-cr-tracker.php';
require_once $plugin_dir . '/includes/class-cr-cron.php';

$wpdb = new Test_WPDB();

function snapshot_for_session( $session_id, $product_name, $total ) {
	global $test_wc;
	$test_wc = new Test_WC( $session_id, $product_name, $total );
	CartRenew_WC_Tracker::save_snapshot();
}

function row_summary( $row ) {
	$contents = json_decode( $row['cart_contents'], true );
	return array(
		'id'            => $row['id'],
		'cart_key'      => $row['cart_key'],
		'status'        => $row['status'],
		'product'       => $contents[0]['name'],
		'order_id'      => isset( $row['order_id'] ) ? $row['order_id'] : null,
		'sent_at'       => isset( $row['sent_at'] ) ? $row['sent_at'] : null,
		'last_activity' => $row['last_activity'],
	);
}

function assert_regression( $condition, $message ) {
	if ( ! $condition ) {
		fwrite( STDERR, "FAIL: {$message}\n" );
		exit( 1 );
	}
}

function verify_recovered_cart_reactivation() {
	global $wpdb, $test_current_user;
	$wpdb->reset();
	$test_current_user = 42;

	snapshot_for_session( 'wc-session-first', 'First purchased cart', '10.00' );
	$first_row = row_summary( $wpdb->rows[0] );
	CartRenew_WC_Tracker::mark_recovered( 1001 );
	snapshot_for_session( 'wc-session-second', 'Later distinct cart', '25.00' );
	$wpdb->age_all_rows();
	$eligible  = CartRenew_WC_DB::get_abandoned_carts( 20 );
	$final_row = row_summary( $wpdb->rows[0] );

	assert_regression( 1 === count( $wpdb->rows ), 'later logged-in cart should update the original user row' );
	assert_regression( $first_row['id'] === $final_row['id'], 'later cart should update the same row id' );
	assert_regression( 'user_42' === $final_row['cart_key'], 'both sessions should use the same user key' );
	assert_regression( 'Later distinct cart' === $final_row['product'], 'later cart contents should overwrite the original contents' );
	assert_regression( 'tracking' === $final_row['status'], 'later cart should reactivate tracking after recovery' );
	assert_regression( null === $final_row['order_id'], 'later cart should clear the prior order id' );
	assert_regression( 1 === count( $eligible ), 'later cart should become eligible after the inactivity cutoff' );

	return array(
		'sessions'      => array( 'wc-session-first', 'wc-session-second' ),
		'firstRow'      => $first_row,
		'finalRow'      => $final_row,
		'eligibleCount' => count( $eligible ),
	);
}

function verify_sent_cart_reactivation() {
	global $wpdb, $test_current_user;
	$wpdb->reset();
	CartRenew_WC_API::$send_calls = 0;
	$test_current_user = 84;

	snapshot_for_session( 'wc-session-third', 'Initially abandoned cart', '15.00' );
	$wpdb->age_all_rows();
	CartRenew_WC_Cron::run();
	$sent_row = row_summary( $wpdb->rows[0] );
	$wpdb->age_all_rows();
	$eligible_before_activity = CartRenew_WC_DB::get_abandoned_carts( 20 );
	snapshot_for_session( 'wc-session-fourth', 'Future distinct cart', '30.00' );
	$wpdb->age_all_rows();
	$eligible  = CartRenew_WC_DB::get_abandoned_carts( 20 );
	$final_row = row_summary( $wpdb->rows[0] );

	assert_regression( 1 === CartRenew_WC_API::$send_calls, 'cron should successfully send the initial cart once' );
	assert_regression( 0 === count( $eligible_before_activity ), 'sent cart should stay excluded without later activity' );
	assert_regression( 1 === count( $wpdb->rows ), 'future logged-in cart should update the sent row' );
	assert_regression( $sent_row['id'] === $final_row['id'], 'future cart should update the sent row id' );
	assert_regression( 'user_84' === $final_row['cart_key'], 'both sessions should use the same user key' );
	assert_regression( 'Future distinct cart' === $final_row['product'], 'future cart contents should overwrite sent cart contents' );
	assert_regression( 'tracking' === $final_row['status'], 'later activity should reactivate tracking after send' );
	assert_regression( null === $final_row['sent_at'], 'later cart should clear the prior sent timestamp' );
	assert_regression( 1 === count( $eligible ), 'later cart should become eligible after the inactivity cutoff' );

	return array(
		'sessions'                    => array( 'wc-session-third', 'wc-session-fourth' ),
		'sendCalls'                   => CartRenew_WC_API::$send_calls,
		'sentRow'                     => $sent_row,
		'eligibleBeforeLaterActivity' => count( $eligible_before_activity ),
		'finalRow'                    => $final_row,
		'eligibleCount'               => count( $eligible ),
	);
}

function verify_opt_out_remains_protected() {
	global $wpdb, $test_current_user;
	$wpdb->reset();
	$test_current_user = 126;

	snapshot_for_session( 'wc-session-fifth', 'Opted-out cart', '12.00' );
	CartRenew_WC_DB::mark_status( 'user_126', 'opted_out' );
	snapshot_for_session( 'wc-session-sixth', 'Later opted-out cart', '18.00' );
	$wpdb->age_all_rows();
	$eligible  = CartRenew_WC_DB::get_abandoned_carts( 20 );
	$final_row = row_summary( $wpdb->rows[0] );

	assert_regression( 'opted_out' === $final_row['status'], 'later snapshots must not reactivate an opted-out shopper' );
	assert_regression( 0 === count( $eligible ), 'opted-out cart must remain excluded' );

	return array(
		'finalRow'      => $final_row,
		'eligibleCount' => count( $eligible ),
	);
}

$evidence = array(
	'recoveredScenario' => verify_recovered_cart_reactivation(),
	'sentScenario'      => verify_sent_cart_reactivation(),
	'optOutScenario'    => verify_opt_out_remains_protected(),
);

echo json_encode( $evidence, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES ) . "\n";
echo "PASS: later logged-in cart activity reactivates sent/recovered rows while opt-out remains protected.\n";
