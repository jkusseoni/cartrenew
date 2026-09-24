<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Runs every 5 minutes (registered in the main plugin file). Finds carts
 * that have gone quiet past the configured wait time, with phone + consent
 * present, and hands each one to CartRenew_WC_API. Rate-limited implicitly
 * by "status='tracking'" only matching once per cart (marked 'sent' or
 * 'send_failed' afterwards, never resent).
 */
class CartRenew_WC_Cron {

	public static function init() {
		add_action( 'cartrenew_wc_check_abandoned', array( __CLASS__, 'run' ) );
	}

	public static function run() {
		$settings = CartRenew_WC_Settings::get_settings();
		if ( empty( $settings['enabled'] ) ) {
			return;
		}

		$minutes = ! empty( $settings['abandon_minutes'] ) ? absint( $settings['abandon_minutes'] ) : 20;
		$carts   = CartRenew_WC_DB::get_abandoned_carts( $minutes );

		// #region agent log
		file_put_contents( '/opt/cursor/logs/debug.log', wp_json_encode( array( 'hypothesisId' => 'A,E', 'location' => 'includes/class-cr-cron.php:27', 'message' => 'Cron selected abandonment candidates', 'data' => array( 'minutes' => $minutes, 'candidate_count' => count( $carts ) ), 'timestamp' => (int) round( microtime( true ) * 1000 ) ) ) . PHP_EOL, FILE_APPEND | LOCK_EX );
		// #endregion

		foreach ( $carts as $cart ) {
			// #region agent log
			file_put_contents( '/opt/cursor/logs/debug.log', wp_json_encode( array( 'hypothesisId' => 'B,C', 'location' => 'includes/class-cr-cron.php:33', 'message' => 'Cron dispatching selected cart', 'data' => array( 'selected_status' => isset( $cart->status ) ? $cart->status : null ), 'timestamp' => (int) round( microtime( true ) * 1000 ) ) ) . PHP_EOL, FILE_APPEND | LOCK_EX );
			// #endregion
			$result = CartRenew_WC_API::send_abandoned_cart( $cart );

			// #region agent log
			file_put_contents( '/opt/cursor/logs/debug.log', wp_json_encode( array( 'hypothesisId' => 'B,C', 'location' => 'includes/class-cr-cron.php:39', 'message' => 'Cron received API result', 'data' => array( 'is_wp_error' => is_wp_error( $result ), 'error_code' => is_wp_error( $result ) ? $result->get_error_code() : null ), 'timestamp' => (int) round( microtime( true ) * 1000 ) ) ) . PHP_EOL, FILE_APPEND | LOCK_EX );
			// #endregion

			if ( is_wp_error( $result ) ) {
				// #region agent log
				file_put_contents( '/opt/cursor/logs/debug.log', wp_json_encode( array( 'hypothesisId' => 'A,E', 'location' => 'includes/class-cr-cron.php:45', 'message' => 'Cron taking terminal failure branch', 'data' => array( 'target_status' => 'send_failed' ), 'timestamp' => (int) round( microtime( true ) * 1000 ) ) ) . PHP_EOL, FILE_APPEND | LOCK_EX );
				// #endregion
				CartRenew_WC_DB::mark_status(
					$cart->cart_key,
					'send_failed',
					array( 'sent_at' => current_time( 'mysql' ) )
				);
				// phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_error_log -- intentional debug trail during dev.
				error_log( 'CartRenew WC send failed for cart ' . $cart->cart_key . ': ' . $result->get_error_message() );
				continue;
			}

			CartRenew_WC_DB::mark_status(
				$cart->cart_key,
				'sent',
				array( 'sent_at' => current_time( 'mysql' ) )
			);
		}
	}
}
