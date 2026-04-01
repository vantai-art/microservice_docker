FROM php:8.2-cli-alpine

RUN apk add --no-cache \
    curl zip unzip git \
    libpng-dev libjpeg-turbo-dev freetype-dev \
    oniguruma-dev libxml2-dev \
    && docker-php-ext-install pdo pdo_mysql mbstring xml bcmath pcntl

# Install composer
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /app

COPY composer.json composer.lock* ./
RUN composer install --no-dev --no-scripts --no-autoloader --ignore-platform-reqs

COPY . .

RUN composer dump-autoload --optimize \
    && php artisan config:cache 2>/dev/null || true \
    && php artisan route:cache  2>/dev/null || true

EXPOSE 8005

CMD ["php", "artisan", "serve", "--host=0.0.0.0", "--port=8005"]
