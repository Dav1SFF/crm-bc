const { createClient } = require('@supabase/supabase-js');
const anon = createClient('https://tvydlquieipjqgyrptry.supabase.co', 'sb_publishable_hRK6aSCtJdALTBEDNOZmiQ_QYHLMp5k');
async function test() {
  const { data: users } = await anon.from('users').select('*');
  const { data: cities } = await anon.from('cities').select('*');
  const { data: notifs } = await anon.from('notifications').select('*');
  console.log('Anon users:', users);
  console.log('Anon cities:', cities);
  console.log('Anon notifs:', notifs);
}
test();
