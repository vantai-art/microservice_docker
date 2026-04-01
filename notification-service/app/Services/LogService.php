<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class LogService
{
    private string $logUrl;

    public function __construct()
    {
        $this->logUrl = env('LOG_SERVICE_URL', 'http://log-service:8006');
    }

    public function log(string $service, string $action, string $detail, int $status = 200): void
    {
        try {
            Http::timeout(2)->post("{$this->logUrl}/api/logs", [
                'service'   => $service,
                'action'    => $action,
                'detail'    => $detail,
                'status'    => $status,
                'level'     => $status >= 500 ? 'ERROR' : ($status >= 400 ? 'WARN' : 'INFO'),
                'timestamp' => now()->toISOString(),
            ]);
        } catch (\Exception $e) {
            Log::warning("LogService failed: " . $e->getMessage());
        }
    }
}
