<?php

$timezoneName = 'Asia/Manila';

if (function_exists('date_default_timezone_set')) {
    date_default_timezone_set($timezoneName);
}

if (!function_exists('manila_timezone')) {
    function manila_timezone(): DateTimeZone
    {
        static $tz = null;

        if ($tz === null) {
            $tz = new DateTimeZone('Asia/Manila');
        }

        return $tz;
    }
}

if (!function_exists('manila_now')) {
    function manila_now(): DateTimeImmutable
    {
        return new DateTimeImmutable('now', manila_timezone());
    }
}


