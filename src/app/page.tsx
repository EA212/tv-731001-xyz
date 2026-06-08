import Link from 'next/link'

export default function Home() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-black">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-white mb-8">
          机佬TV
        </h1>
        <Link 
          href="/jilaotv"
          className="text-2xl text-blue-500 hover:text-blue-400 transition-colors cursor-pointer"
        >
          点击进入 →
        </Link>
      </div>
    </div>
  )
}
