/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                gold: {
                    50: '#FBF8F1',
                    100: '#F5EFDB',
                    200: '#EADBB2',
                    300: '#DFC282',
                    400: '#D4A754',
                    500: '#C68E34',
                    600: '#AA7129',
                    700: '#885425',
                    800: '#704325',
                    900: '#5D3822',
                },
            },
            fontFamily: {
                sans: ['Roboto', 'sans-serif'],
                serif: ['Roboto', 'sans-serif'],
            },
            fontSize: {
                'xs': ['0.6rem', { lineHeight: '1rem' }],
                'sm': ['0.7rem', { lineHeight: '1.25rem' }],
                'base': ['0.8rem', { lineHeight: '1.5rem' }],
                'lg': ['0.9rem', { lineHeight: '1.75rem' }],
                'xl': ['1rem', { lineHeight: '1.75rem' }],
                '2xl': ['1.2rem', { lineHeight: '2rem' }],
                '3xl': ['1.5rem', { lineHeight: '2.25rem' }],
                '4xl': ['1.8rem', { lineHeight: '2.5rem' }],
                '5xl': ['2.4rem', { lineHeight: '1' }],
                '6xl': ['3rem', { lineHeight: '1' }],
                '7xl': ['3.6rem', { lineHeight: '1' }],
                '8xl': ['4.8rem', { lineHeight: '1' }],
                '9xl': ['6.4rem', { lineHeight: '1' }],
            },
            backgroundImage: {
                'gold-gradient': 'linear-gradient(135deg, #BF953F 0%, #FCF6BA 50%, #B38728 100%)',
                'subtle-pattern': "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23d4a754' fill-opacity='0.05'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
            }
        },
    },
    plugins: [],
}
