<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\NotificationController;

// Health check
Route::get('/health', fn() => response()->json([
    'status'  => 'ok',
    'service' => 'notification-service',
]));

// Stats (Admin/Staff)
Route::get('/notifications/stats', [NotificationController::class, 'stats']);

// CRUD
Route::apiResource('notifications', NotificationController::class);

// Send channels
Route::post('/notifications/send-email', [NotificationController::class, 'sendEmail']);
Route::post('/notifications/send-sms',   [NotificationController::class, 'sendSms']);
Route::post('/notifications/send-push',  [NotificationController::class, 'sendPush']);

// User-specific
Route::get('/notifications/user/{userId}',          [NotificationController::class, 'getByUser']);
Route::put('/notifications/user/{userId}/read-all', [NotificationController::class, 'markAllRead']);
Route::put('/notifications/{notification}/read',    [NotificationController::class, 'markRead']);
