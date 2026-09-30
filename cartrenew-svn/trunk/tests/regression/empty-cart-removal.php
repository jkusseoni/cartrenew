<?php
/**
 * Regression coverage for removing the final item from a tracked cart.
 *
 * Run from the repository root:
 * php cartrenew-svn/trunk/tests/regression/empty-cart-removal.php
 */

define( 'ABSPATH', __DIR__ . '/' );
define( 'HOUR_IN_SECONDS', 3600 );

$test_wc = null;

function WC() {
	global $test_wc;
	return $test_wc;
}

function is_user_logged_in() {
	return false;
}

function get_current_user_id() {
	return 0;
}

function wp_get_current_user() {
	return (object) array( 'display_name' => '' );
}

function wp_json_encode( $value ) {
	return json_encode( $value );
}

function wc_get_cart_url() {
	return 'https://example.invalid/cart';
}

function current_time( $type ) {
	return '2026-09-30 10:00:00';
}

function get_option( $name ) {
	return 'gmt_offset' === $name ? 0 : null;
}

class CartRenew_WC_Settings {
	public static function get_settings() {
		return array( 'enabled' => true );
	}
}

class Test_Session {
	public function get_customer_id() {
		return 'empty-cart-session';
	}

	public function get( $key, $default = '' ) {
		$values = array(
			'cartrenew_phone'   => '+15555550123',
			'cartrenew_consent' => 'yes',
		);
		return array_key_exists( $key, $values ) ? $values[ $key ] : $default;
	}
}

class Test_Product {
	public function get_name() {
		return 'Tracked product';
	}

	public function get_price() {
		return '25.00';
	}
}

class Test_Cart {
	private $items;

	public function __construct() {
		$this->items = array(
			array(
				'data'     => new Test_Product(),
				'quantity' => 1,
			),
		);
	}

	public function empty_cart() {
		$this->items = array();
	}

	public function is_empty() {
		return empty( $this->items );
	}

	public function get_cart() {
		return $this->items;
	}

	public function get_total( $context ) {
		return empty( $this->items ) ? '0.00' : '25.00';
	}
}

class Test_WC {
	public $session;
	public $cart;

	public function __construct() {
		$this->session = new Test_Session();
		$this->cart    = new Test_Cart();
	}
}

class Test_Prepared_Query {
	public $args;

	public function __construct( $args ) {
		$this->args = $args;
	}
}

class Test_WPDB {
	public $prefix = 'wp_';
	public $insert_id = 0;
	public $rows = array();

	public function prepare( $sql, ...$args ) {
		return new Test_Prepared_Query( $args );
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
		$this->insert_id++;
		$data['id']   = $this->insert_id;
		$this->rows[] = $data;
		return 1;
	}

	public function update( $table, $data, $where ) {
		foreach ( $this->rows as &$row ) {
			$matches = isset( $where['id'] )
				? $row['id'] === $where['id']
				: $row['cart_key'] === $where['cart_key'];
			if ( $matches ) {
				$row = array_merge( $row, $data );
			}
		}
		return 1;
	}

	public function delete( $table, $where ) {
		$this->rows = array_values(
			array_filter(
				$this->rows,
				function ( $row ) use ( $where ) {
					foreach ( $where as $key => $value ) {
						if ( $row[ $key ] !== $value ) {
							return true;
						}
					}
					return false;
				}
			)
		);
		return 1;
	}

	public function get_results( $query ) {
		list( $status, $consent, $empty_phone, $cutoff, $limit ) = $query->args;
		$eligible = array_filter(
			$this->rows,
			fn( $row ) => $row['status'] === $status
				&& $row['consent'] === $consent
				&& null !== $row['phone_number']
				&& $row['phone_number'] !== $empty_phone
				&& $row['last_activity'] <= $cutoff
		);
		return array_map( fn( $row ) => (object) $row, array_slice( $eligible, 0, $limit ) );
	}
}

$plugin_dir = getenv( 'CARTRENEW_TEST_PLUGIN_DIR' );
if ( ! $plugin_dir ) {
	$plugin_dir = dirname( __DIR__, 2 );
}

require_once $plugin_dir . '/includes/class-cr-db.php';
require_once $plugin_dir . '/includes/class-cr-tracker.php';

$wpdb    = new Test_WPDB();
$test_wc = new Test_WC();

CartRenew_WC_Tracker::save_snapshot();
if ( 1 !== count( $wpdb->rows ) ) {
	fwrite( STDERR, "FAIL: a non-empty cart should create one tracking row.\n" );
	exit( 1 );
}

$test_wc->cart->empty_cart();
CartRenew_WC_Tracker::save_snapshot();

foreach ( $wpdb->rows as &$row ) {
	$row['last_activity'] = '2000-01-01 00:00:00';
}
$eligible = CartRenew_WC_DB::get_abandoned_carts( 20 );

if ( 0 !== count( $wpdb->rows ) || 0 !== count( $eligible ) ) {
	fwrite( STDERR, "FAIL: emptying the cart left a stale row eligible for recovery.\n" );
	exit( 1 );
}

$test_wc = new Test_WC();
CartRenew_WC_Tracker::save_snapshot();
CartRenew_WC_DB::mark_status( 'session_empty-cart-session', 'recovered' );
$test_wc->cart->empty_cart();
CartRenew_WC_Tracker::save_snapshot();

if ( 1 !== count( $wpdb->rows ) || 'recovered' !== $wpdb->rows[0]['status'] ) {
	fwrite( STDERR, "FAIL: emptying the cart should not delete terminal history.\n" );
	exit( 1 );
}

echo "PASS: emptying a tracked cart removes recovery eligibility and preserves terminal history.\n";
