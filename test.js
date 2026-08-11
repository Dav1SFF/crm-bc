const { createClient } = require('@supabase/supabase-js');
const anon = createClient('https://tvydlquieipjqgyrptry.supabase.co', 'sb_publishable_hRK6aSCtJdALTBEDNOZmiQ_QYHLMp5k');

async function test() {
  const { data, error } = await anon.from('action_logs').insert([
    {
      user_name: 'test_user',
      action_type: 'LOGIN',
      entity_id: null,
      entity_name: null,
      details: {}
    }
  ]).select('*');
  
  console.log('Insert Error:', error);
  console.log('Insert Data:', data);
}
test();
