<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class Notification extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'type',
        'title',
        'message',
        'status',
        'read',
        'read_at',
        'meta',
        'channel',
    ];

    protected $casts = [
        'read'    => 'boolean',
        'read_at' => 'datetime',
        'meta'    => 'array',
    ];
}
