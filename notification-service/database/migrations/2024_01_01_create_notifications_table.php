<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('notifications', function (Blueprint $table) {
            $table->id();
            $table->string('user_id')->index();
            $table->enum('type', ['EMAIL', 'SMS', 'PUSH']);
            $table->string('title');
            $table->text('message');
            $table->enum('status', ['PENDING', 'SENT', 'FAILED'])->default('PENDING');
            $table->boolean('read')->default(false);
            $table->timestamp('read_at')->nullable();
            $table->json('meta')->nullable();       // extra data: to, phone, fcm_token
            $table->string('channel')->nullable();  // specific channel or topic
            $table->timestamps();

            $table->index(['user_id', 'read']);
            $table->index(['type', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('notifications');
    }
};
