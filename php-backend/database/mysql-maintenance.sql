-- ========================================
-- MySQL Maintenance Scripts for RFID-MQTT
-- ========================================
-- Run these commands periodically for optimal performance
-- ========================================

USE it414_db_ajjcr;

-- ==================== INDEX STATISTICS ====================
-- Updates index statistics for better query planning
-- Run: Weekly or after bulk inserts

ANALYZE TABLE rfid_reg;
ANALYZE TABLE rfid_logs;

-- ==================== TABLE OPTIMIZATION ====================
-- Defragments tables and reclaims unused space
-- Run: Monthly or when table grows significantly

OPTIMIZE TABLE rfid_logs;
-- Note: OPTIMIZE TABLE rebuilds the table, may take time

-- ==================== VERIFY INDEXES ====================
-- Check that all indexes are in place

SHOW INDEX FROM rfid_reg;
SHOW INDEX FROM rfid_logs;

-- Expected indexes on rfid_reg:
-- - PRIMARY KEY (id)
-- - UNIQUE KEY (rfid_data)
-- - INDEX idx_rfid_data_status (rfid_data, rfid_status)

-- Expected indexes on rfid_logs:
-- - PRIMARY KEY (id)
-- - INDEX idx_time_log (time_log DESC)
-- - INDEX idx_rfid_data (rfid_data)
-- - INDEX idx_composite (time_log DESC, rfid_data)
-- - INDEX idx_covering (time_log DESC, rfid_data, rfid_status, id)

-- ==================== QUERY PERFORMANCE CHECK ====================
-- Test query performance with EXPLAIN

EXPLAIN SELECT 
    l.id,
    l.time_log,
    l.rfid_data,
    l.rfid_status,
    r.rfid_status AS current_rfid_status
FROM rfid_logs l
LEFT JOIN rfid_reg r ON l.rfid_data = r.rfid_data
ORDER BY l.time_log DESC
LIMIT 50;

-- Check that:
-- - type should be 'index' or 'ALL' with covering index
-- - Extra should show 'Using index' (best) or 'Using where; Using index'
-- - rows should be reasonable (<1000 for LIMIT 50)

-- ==================== CLEANUP OLD LOGS ====================
-- Remove logs older than 90 days to keep table size manageable
-- Run: Monthly

DELETE FROM rfid_logs 
WHERE time_log < DATE_SUB(NOW(), INTERVAL 90 DAY)
LIMIT 1000;

-- Note: Use LIMIT to prevent long-running deletes
-- Run multiple times if needed

-- ==================== CHECK TABLE SIZE ====================
-- Monitor table sizes

SELECT 
    table_name,
    ROUND(((data_length + index_length) / 1024 / 1024), 2) AS 'Size (MB)',
    table_rows
FROM information_schema.TABLES
WHERE table_schema = 'it414_db_ajjcr';

-- ==================== INNODB STATUS ====================
-- Check InnoDB buffer pool hit rate
-- Goal: >95% hit rate

SHOW STATUS LIKE 'Innodb_buffer_pool_read_requests';
SHOW STATUS LIKE 'Innodb_buffer_pool_reads';

-- Buffer pool hit rate formula:
-- hit_rate = (read_requests - reads) / read_requests * 100

-- ==================== QUERY CACHE STATS ====================
-- Check query cache effectiveness (MySQL 5.7 and earlier)

SHOW STATUS LIKE 'Qcache%';

-- Key metrics:
-- - Qcache_hits: Number of cache hits
-- - Qcache_inserts: Number of queries added to cache
-- - Hit rate = Qcache_hits / (Qcache_hits + Qcache_inserts) * 100
-- Goal: >90% hit rate

-- ==================== FRAGMENTATION CHECK ====================
-- Check for fragmented tables

SELECT 
    table_name,
    data_free / 1024 / 1024 AS 'Fragmentation (MB)'
FROM information_schema.TABLES
WHERE table_schema = 'it414_db_ajjcr'
AND data_free > 0;

-- If fragmentation > 100MB, run OPTIMIZE TABLE

-- ========================================
-- MAINTENANCE SCHEDULE
-- ========================================
-- Daily: None required
-- Weekly: ANALYZE TABLE
-- Monthly: OPTIMIZE TABLE, cleanup old logs
-- Quarterly: Review indexes, check fragmentation
-- ========================================

