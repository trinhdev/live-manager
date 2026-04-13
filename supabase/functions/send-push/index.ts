// Supabase Edge Function: send-push
// Gọi OneSignal REST API từ server-side để gửi background push notification
// Runtime: Deno (Supabase Edge Runtime)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    // Lấy secrets từ Supabase (an toàn, không bao giờ ra ngoài browser)
    const REST_API_KEY = Deno.env.get('ONESIGNAL_REST_API_KEY')
    const APP_ID = Deno.env.get('ONESIGNAL_APP_ID')

    if (!REST_API_KEY || !APP_ID) {
      console.error('[send-push] Missing OneSignal env secrets')
      return new Response(JSON.stringify({ error: 'OneSignal not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { title, message, targetUserIds } = await req.json()

    if (!title || !message) {
      return new Response(JSON.stringify({ error: 'title and message required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Build OneSignal payload
    const payload: Record<string, unknown> = {
      app_id: APP_ID,
      headings: { en: title, vi: title },
      contents: { en: message, vi: message },
      target_channel: 'push',
    }

    if (targetUserIds && Array.isArray(targetUserIds) && targetUserIds.length > 0) {
      // Gửi đến user cụ thể (đã đăng ký với OneSignal.login(userId))
      payload.include_aliases = { external_id: targetUserIds }
    } else {
      // Broadcast cho tất cả subscriber
      payload.included_segments = ['All']
    }

    console.log('[send-push] Sending to:', targetUserIds?.length ? `${targetUserIds.length} users` : 'All')

    const response = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${REST_API_KEY}`,
      },
      body: JSON.stringify(payload),
    })

    const data = await response.json()

    if (!response.ok) {
      console.error('[send-push] OneSignal error:', data)
      return new Response(JSON.stringify({ error: data }), {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log('[send-push] Success, id:', data.id, 'recipients:', data.recipients)

    return new Response(JSON.stringify({ success: true, id: data.id, recipients: data.recipients }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (err) {
    console.error('[send-push] Unexpected error:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
