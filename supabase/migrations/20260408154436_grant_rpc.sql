-- Grant execute on RPC to service_role and anon so PostgREST exposes it
GRANT EXECUTE ON FUNCTION increment_video_count(UUID, TEXT, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION increment_video_count(UUID, TEXT, INTEGER) TO anon;
