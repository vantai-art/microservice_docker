<?php

namespace App\Http\Controllers;

use App\Models\Notification;
use App\Services\LogService;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    public function __construct(private LogService $logService) {}

    // ─── List All (Admin/Staff) ──────────────────────────
    public function index(Request $request)
    {
        $query = Notification::query();

        if ($request->has('type'))    $query->where('type', $request->type);
        if ($request->has('status'))  $query->where('status', $request->status);
        if ($request->has('user_id')) $query->where('user_id', $request->user_id);

        $notifications = $query->latest()->paginate($request->get('per_page', 20));

        $this->logService->log('notification-service', 'LIST_ALL', "count={$notifications->total()}");
        return response()->json($notifications);
    }

    // ─── Create Notification ─────────────────────────────
    public function store(Request $request)
    {
        $data = $request->validate([
            'user_id' => 'required|string',
            'type'    => 'required|in:EMAIL,SMS,PUSH',
            'title'   => 'required|string|max:255',
            'message' => 'required|string',
            'channel' => 'nullable|string',
        ]);

        $notification = Notification::create([
            ...$data,
            'status' => 'PENDING',
            'read'   => false,
        ]);

        $this->logService->log('notification-service', 'CREATE', "type={$data['type']}, userId={$data['user_id']}");
        return response()->json($notification, 201);
    }

    // ─── Get by ID ───────────────────────────────────────
    public function show(Notification $notification)
    {
        $this->logService->log('notification-service', 'GET_ONE', "id={$notification->id}");
        return response()->json($notification);
    }

    // ─── Get by User ─────────────────────────────────────
    public function getByUser(string $userId)
    {
        $notifications = Notification::where('user_id', $userId)
            ->latest()
            ->paginate(20);

        $this->logService->log('notification-service', 'GET_BY_USER', "userId={$userId}");
        return response()->json($notifications);
    }

    // ─── Mark as Read ────────────────────────────────────
    public function markRead(Notification $notification)
    {
        $notification->update(['read' => true, 'read_at' => now()]);
        $this->logService->log('notification-service', 'MARK_READ', "id={$notification->id}");
        return response()->json($notification);
    }

    // ─── Mark All Read (by user) ─────────────────────────
    public function markAllRead(string $userId)
    {
        $count = Notification::where('user_id', $userId)
            ->where('read', false)
            ->update(['read' => true, 'read_at' => now()]);

        $this->logService->log('notification-service', 'MARK_ALL_READ', "userId={$userId}, count={$count}");
        return response()->json(['message' => "Đã đánh dấu {$count} thông báo là đã đọc"]);
    }

    // ─── Send Email ──────────────────────────────────────
    public function sendEmail(Request $request)
    {
        $data = $request->validate([
            'to'      => 'required|email',
            'subject' => 'required|string|max:255',
            'body'    => 'required|string',
            'user_id' => 'required|string',
        ]);

        // Production: Mail::to($data['to'])->send(new GenericMail($data));
        // or use Mailgun / SendGrid API

        $notification = Notification::create([
            'user_id' => $data['user_id'],
            'type'    => 'EMAIL',
            'title'   => $data['subject'],
            'message' => $data['body'],
            'status'  => 'SENT',
            'read'    => false,
            'meta'    => json_encode(['to' => $data['to']]),
        ]);

        $this->logService->log('notification-service', 'SEND_EMAIL', "to={$data['to']}");
        return response()->json(['message' => 'Email đã được gửi', 'notification' => $notification], 201);
    }

    // ─── Send SMS ────────────────────────────────────────
    public function sendSms(Request $request)
    {
        $data = $request->validate([
            'phone'   => 'required|string|max:20',
            'message' => 'required|string|max:160',
            'user_id' => 'required|string',
        ]);

        // Production: Twilio::message($data['phone'], $data['message']);
        // or VNPT / Viettel SMS API

        $notification = Notification::create([
            'user_id' => $data['user_id'],
            'type'    => 'SMS',
            'title'   => 'SMS Notification',
            'message' => $data['message'],
            'status'  => 'SENT',
            'read'    => false,
            'meta'    => json_encode(['phone' => $data['phone']]),
        ]);

        $this->logService->log('notification-service', 'SEND_SMS', "phone={$data['phone']}");
        return response()->json(['message' => 'SMS đã được gửi', 'notification' => $notification], 201);
    }

    // ─── Send Push ───────────────────────────────────────
    public function sendPush(Request $request)
    {
        $data = $request->validate([
            'user_id'  => 'required|string',
            'title'    => 'required|string|max:255',
            'message'  => 'required|string',
            'fcm_token'=> 'nullable|string',
        ]);

        // Production: Firebase::sendNotification($data['fcm_token'], $data['title'], $data['message']);

        $notification = Notification::create([
            'user_id' => $data['user_id'],
            'type'    => 'PUSH',
            'title'   => $data['title'],
            'message' => $data['message'],
            'status'  => 'SENT',
            'read'    => false,
            'meta'    => json_encode(['fcm_token' => $data['fcm_token'] ?? null]),
        ]);

        $this->logService->log('notification-service', 'SEND_PUSH', "userId={$data['user_id']}");
        return response()->json(['message' => 'Push notification đã được gửi', 'notification' => $notification], 201);
    }

    // ─── Stats (Admin/Staff) ─────────────────────────────
    public function stats()
    {
        $stats = [
            'total'      => Notification::count(),
            'unread'     => Notification::where('read', false)->count(),
            'sent'       => Notification::where('status', 'SENT')->count(),
            'pending'    => Notification::where('status', 'PENDING')->count(),
            'failed'     => Notification::where('status', 'FAILED')->count(),
            'by_type'    => [
                'EMAIL' => Notification::where('type', 'EMAIL')->count(),
                'SMS'   => Notification::where('type', 'SMS')->count(),
                'PUSH'  => Notification::where('type', 'PUSH')->count(),
            ],
            'today'      => Notification::whereDate('created_at', today())->count(),
        ];

        $this->logService->log('notification-service', 'GET_STATS', 'stats requested');
        return response()->json($stats);
    }

    // ─── Delete (Admin) ──────────────────────────────────
    public function destroy(Notification $notification)
    {
        $notification->delete();
        $this->logService->log('notification-service', 'DELETE', "id={$notification->id}");
        return response()->json(['message' => 'Đã xóa thông báo']);
    }
}
