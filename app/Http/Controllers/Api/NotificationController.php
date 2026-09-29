<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Notifications\DatabaseNotification;

/**
 * The user's (or admin's) in-app inbox. Notifications are Laravel database
 * notifications, so the shape is fixed: uuid id, type, data payload, read_at.
 */
class NotificationController extends Controller
{
    /** Inbox, newest first. */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        return response()->json([
            'data' => $user->notifications()->limit(30)->get()->map(fn (DatabaseNotification $n) => [
                'id' => $n->id,
                'type' => class_basename($n->type),
                'data' => $n->data,
                'read_at' => $n->read_at,
                'created_at' => $n->created_at,
            ]),
            'unread' => $user->unreadNotifications()->count(),
        ]);
    }

    /** Badge count only — the cheap polling target. */
    public function unread(Request $request): JsonResponse
    {
        return response()->json(['unread' => $request->user()->unreadNotifications()->count()]);
    }

    /**
     * Route model binding resolves ANY notification id, so ownership has to be
     * checked by hand here — otherwise anyone could mark a stranger's mail read.
     */
    public function read(Request $request, DatabaseNotification $notification): JsonResponse
    {
        $user = $request->user();

        abort_unless(
            $notification->notifiable_type === $user::class && (int) $notification->notifiable_id === $user->id,
            404,
        );

        $notification->markAsRead();

        return response()->json(['ok' => true]);
    }

    /** Flips every unread row for the caller only — the relation scopes it. */
    public function readAll(Request $request): JsonResponse
    {
        $request->user()->unreadNotifications()->update(['read_at' => now()]);

        return response()->json(['ok' => true]);
    }
}
