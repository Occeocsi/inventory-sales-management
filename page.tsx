"use client"
import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import LoginPage from "@/components/login-page"

export default function HomePage() {
  const { user } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (user) {
      if (user.role === "staff") {
        router.push("/dashboard/staff")
      } else {
        router.push("/dashboard/customer")
      }
    }
  }, [user, router])

  return <LoginPage />
}
