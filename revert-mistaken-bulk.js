import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config()

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY)

async function run() {
  // 1. Find all assets that were mistakenly migrated
  const { data: assets, error } = await supabase
    .from('assets')
    .select('*')
    .ilike('notes', '%[Migrated to Bulk Module]%')
    .not('category', 'in', '("Scaffolding", "Structural Materials", "Bulk Items", "Pipes", "Plates")')

  if (error) {
    console.error(error)
    return
  }

  console.log(`Found ${assets.length} mistakenly migrated assets.`)
  
  for (const asset of assets) {
    console.log(`Reverting ${asset.asset_name} (${asset.category})`)
    
    // 1. Find the bulk_item that was created
    const { data: item } = await supabase
      .from('bulk_items')
      .select('id')
      .eq('item_code', asset.asset_code)
      .single()
      
    if (item) {
      // Delete stock
      await supabase.from('bulk_site_stock').delete().eq('item_id', item.id)
      // Delete transactions
      await supabase.from('bulk_transactions').delete().eq('item_id', item.id)
      // Delete master item
      await supabase.from('bulk_items').delete().eq('id', item.id)
    }

    // 2. Restore the asset
    const newNotes = asset.notes.replace(' | [Migrated to Bulk Module]', '').trim()
    
    // We don't know the exact original quantity, but if it was migrated because of `quantity > 1`, we need it back.
    // Let's assume the current bulk stock was the original quantity, but we deleted it.
    // Wait, the migration set quantity = 0! 
    // Let's look at bulk_transactions to find the original quantity migrated.
    let originalQty = 1;
    if (item) {
      const { data: tx } = await supabase
        .from('bulk_transactions')
        .select('quantity')
        .eq('item_id', item.id)
        .eq('notes', 'Migrated from legacy assets table')
        .single()
      if (tx) originalQty = tx.quantity
    }

    await supabase.from('assets').update({
      status: 'Active',
      quantity: originalQty,
      notes: newNotes
    }).eq('id', asset.id)
  }
  
  console.log('Revert complete.')
}

run()
