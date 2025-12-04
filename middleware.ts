import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
    const origin = request.headers.get('origin') || ''

    // Define allowed origins
    const allowedOrigins = [
        'capacitor://localhost',
        'http://localhost',
        'https://enludus.vercel.app',
        'http://localhost:3000'
    ]

    // Check if the origin is allowed
    // Note: Mobile apps (Capacitor) send 'capacitor://localhost' (iOS) or 'http://localhost' (Android)
    const isAllowedOrigin = allowedOrigins.includes(origin)

    // Prepare the response
    // For OPTIONS request, we return a direct response
    if (request.method === 'OPTIONS') {
        const response = new NextResponse(null, { status: 200 })
        if (isAllowedOrigin) {
            response.headers.set('Access-Control-Allow-Origin', origin)
            response.headers.set('Access-Control-Allow-Credentials', 'true')
            response.headers.set('Access-Control-Allow-Methods', 'GET,DELETE,PATCH,POST,PUT,OPTIONS')
            response.headers.set(
                'Access-Control-Allow-Headers',
                'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
            )
        }
        return response
    }

    // For other requests, we continue and add headers to the response
    const response = NextResponse.next()

    if (isAllowedOrigin) {
        response.headers.set('Access-Control-Allow-Origin', origin)
        response.headers.set('Access-Control-Allow-Credentials', 'true')
        response.headers.set('Access-Control-Allow-Methods', 'GET,DELETE,PATCH,POST,PUT,OPTIONS')
        response.headers.set(
            'Access-Control-Allow-Headers',
            'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
        )
    }

    return response
}

export const config = {
    matcher: '/api/:path*',
}
