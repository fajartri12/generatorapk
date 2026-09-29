<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Cross-Origin Resource Sharing (CORS) Configuration
    |--------------------------------------------------------------------------
    |
    | The SPA is its own project (mdgenerator-frontend) on its own origin, so
    | the API is genuinely cross-origin now and only the frontend origin may
    | call it with credentials. `paths` stays scoped to the API: the browser
    | redirects (Google OAuth, password reset) are top-level navigations, which
    | CORS does not apply to.
    |
    */

    'paths' => ['api/*', 'sanctum/csrf-cookie'],

    'allowed_methods' => ['*'],

    'allowed_origins' => explode(',', env('FRONTEND_URL', 'http://localhost:5173')),

    'allowed_origins_patterns' => [],

    'allowed_headers' => ['*'],

    'exposed_headers' => [],

    'max_age' => 0,

    'supports_credentials' => true,

];
