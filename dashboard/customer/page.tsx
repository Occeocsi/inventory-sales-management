"use client"
import { useEffect, useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import {
  ScanLine,
  Plus,
  Minus,
  Trash2,
  CreditCard,
  DollarSign,
  CheckCircle,
  AlertCircle,
  Wifi,
  WifiOff,
} from "lucide-react"
import DashboardLayout from "@/components/dashboard-layout"
import { useDataStore, type CartItem } from "@/lib/data-store"

// ESP8266 WebSocket connection settings
const ESP_WEBSOCKET_URL = "ws://esp8266-scanner.local:81"

export default function CustomerSelfCheckout() {
  const { user, isLoading } = useAuth()
  const { products, updateProductQuantity } = useDataStore()
  const router = useRouter()
  const [cart, setCart] = useState<CartItem[]>([])
  const [scanInput, setScanInput] = useState("")
  const [isProcessingPayment, setIsProcessingPayment] = useState(false)
  const [paymentSuccess, setPaymentSuccess] = useState(false)
  const [paymentTotal, setPaymentTotal] = useState(0)
  const [scanError, setScanError] = useState("")
  const [scannerConnected, setScannerConnected] = useState(false)
  const [lastScannedCode, setLastScannedCode] = useState("")
  const [scannerStatus, setScannerStatus] = useState<"connecting" | "connected" | "disconnected">("disconnected")

  const websocketRef = useRef<WebSocket | null>(null)

  // Connect to ESP8266 WebSocket server
  useEffect(() => {
    const connectWebSocket = () => {
      try {
        setScannerStatus("connecting")
        const ws = new WebSocket(ESP_WEBSOCKET_URL)

        ws.onopen = () => {
          console.log("Connected to ESP8266 scanner")
          setScannerConnected(true)
          setScannerStatus("connected")
        }

        ws.onmessage = (event) => {
          const scannedCode = event.data
          console.log("Received barcode:", scannedCode)
          setLastScannedCode(scannedCode)
          handleScan(scannedCode)
        }

        ws.onclose = () => {
          console.log("Disconnected from ESP8266 scanner")
          setScannerConnected(false)
          setScannerStatus("disconnected")
          // Try to reconnect after 5 seconds
          setTimeout(connectWebSocket, 5000)
        }

        ws.onerror = (error) => {
          console.error("WebSocket error:", error)
          setScannerConnected(false)
          setScannerStatus("disconnected")
        }

        websocketRef.current = ws
      } catch (error) {
        console.error("Failed to connect to ESP8266:", error)
        setScannerStatus("disconnected")
      }
    }

    connectWebSocket()

    // Cleanup on component unmount
    return () => {
      if (websocketRef.current) {
        websocketRef.current.close()
      }
    }
  }, [])

  useEffect(() => {
    if (!isLoading && (!user || user.role !== "customer")) {
      router.push("/")
    }
  }, [user, isLoading, router])

  const handleScan = (searchTerm: string) => {
    setScanError("")
    const product = products.find(
      (p) =>
        p.sku.toLowerCase() === searchTerm.toLowerCase() ||
        p.name.toLowerCase() === searchTerm.toLowerCase() ||
        p.name.toLowerCase().includes(searchTerm.toLowerCase()),
    )

    if (product) {
      const existingItem = cart.find((item) => item.id === product.id)

      if (existingItem) {
        setCart(cart.map((item) => (item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item)))
      } else {
        setCart([
          ...cart,
          {
            id: product.id,
            name: product.name,
            price: product.price,
            quantity: 1,
            sku: product.sku,
          },
        ])
      }
      setScanInput("")
    } else {
      setScanError(`Product not found: "${searchTerm}". Try entering the SKU code or product name.`)
    }
  }

  const updateQuantity = (id: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      removeItem(id)
    } else {
      setCart(cart.map((item) => (item.id === id ? { ...item, quantity: newQuantity } : item)))
    }
  }

  const removeItem = (id: string) => {
    setCart(cart.filter((item) => item.id !== id))
  }

  const getTotal = () => {
    return cart.reduce((total, item) => total + item.price * item.quantity, 0)
  }

  const getTax = () => {
    return getTotal() * 0.08
  }

  const getFinalTotal = () => {
    return getTotal() + getTax()
  }

  const handlePayment = async (method: "card" | "cash") => {
    setIsProcessingPayment(true)
    setPaymentSuccess(false)

    await new Promise((resolve) => setTimeout(resolve, 2000))

    // Update inventory quantities
    cart.forEach((item) => {
      updateProductQuantity(item.id, -item.quantity)
    })

    setPaymentTotal(getFinalTotal())
    setPaymentSuccess(true)
    setIsProcessingPayment(false)

    setTimeout(() => {
      setCart([])
      setPaymentSuccess(false)
      setPaymentTotal(0)
    }, 5000)
  }

  const startNewTransaction = () => {
    setCart([])
    setPaymentSuccess(false)
    setPaymentTotal(0)
    setScanInput("")
    setScanError("")
  }

  const reconnectScanner = () => {
    if (websocketRef.current) {
      websocketRef.current.close()
      websocketRef.current = null
    }

    setScannerStatus("connecting")
    const ws = new WebSocket(ESP_WEBSOCKET_URL)

    ws.onopen = () => {
      console.log("Reconnected to ESP8266 scanner")
      setScannerConnected(true)
      setScannerStatus("connected")
    }

    ws.onmessage = (event) => {
      const scannedCode = event.data
      console.log("Received barcode:", scannedCode)
      setLastScannedCode(scannedCode)
      handleScan(scannedCode)
    }

    ws.onclose = () => {
      console.log("Disconnected from ESP8266 scanner")
      setScannerConnected(false)
      setScannerStatus("disconnected")
    }

    ws.onerror = (error) => {
      console.error("WebSocket error:", error)
      setScannerConnected(false)
      setScannerStatus("disconnected")
    }

    websocketRef.current = ws
  }

  if (isLoading || !user) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>
  }

  if (paymentSuccess) {
    return (
      <DashboardLayout>
        <div className="max-w-2xl mx-auto">
          <Card className="border-green-200 bg-green-50">
            <CardContent className="pt-6">
              <div className="text-center space-y-6">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle className="h-8 w-8 text-green-600" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-green-900">Payment Successful!</h1>
                  <p className="text-green-700 mt-2">Your transaction has been completed</p>
                </div>
                <div className="bg-white rounded-lg p-4 border border-green-200">
                  <div className="text-3xl font-bold text-green-900">${paymentTotal.toFixed(2)}</div>
                  <p className="text-sm text-green-600">Total Amount Paid</p>
                </div>
                <div className="space-y-2">
                  <p className="text-sm text-green-700">Thank you for shopping with us!</p>
                  <p className="text-xs text-green-600">Starting new transaction in a few seconds...</p>
                </div>
                <Button onClick={startNewTransaction} className="bg-green-600 hover:bg-green-700">
                  Start New Transaction
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Self-Checkout</h1>
          <p className="text-gray-600 mt-2">Scan your items and complete your purchase</p>
        </div>

        {/* Scanner Status */}
        <Card className="mb-6">
          <CardContent className="pt-6 pb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {scannerStatus === "connected" ? (
                  <Badge
                    variant="outline"
                    className="bg-green-50 text-green-700 border-green-200 flex items-center gap-1.5"
                  >
                    <Wifi className="h-3.5 w-3.5" />
                    Scanner Connected
                  </Badge>
                ) : scannerStatus === "connecting" ? (
                  <Badge
                    variant="outline"
                    className="bg-yellow-50 text-yellow-700 border-yellow-200 flex items-center gap-1.5"
                  >
                    <div className="h-2 w-2 rounded-full bg-yellow-500 animate-pulse" />
                    Connecting to Scanner...
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 flex items-center gap-1.5">
                    <WifiOff className="h-3.5 w-3.5" />
                    Scanner Disconnected
                  </Badge>
                )}

                {lastScannedCode && (
                  <span className="text-sm text-gray-500">
                    Last scanned: <span className="font-mono">{lastScannedCode}</span>
                  </span>
                )}
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={reconnectScanner}
                disabled={scannerStatus === "connected" || scannerStatus === "connecting"}
              >
                Reconnect Scanner
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ScanLine className="h-5 w-5" />
                Scan Items
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {scanError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{scanError}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium">Scan or Enter SKU</label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Scan barcode, enter SKU, or product name..."
                    value={scanInput}
                    onChange={(e) => setScanInput(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === "Enter" && scanInput.trim()) {
                        handleScan(scanInput.trim())
                      }
                    }}
                    className="text-lg"
                  />
                  <Button onClick={() => scanInput.trim() && handleScan(scanInput.trim())} disabled={!scanInput.trim()}>
                    Add
                  </Button>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <label className="text-sm font-medium">Quick Add (Demo)</label>
                <div className="grid grid-cols-1 gap-2">
                  {products.slice(0, 3).map((product) => (
                    <Button
                      key={product.id}
                      variant="outline"
                      onClick={() => handleScan(product.sku)}
                      className="justify-between"
                    >
                      <span>{product.name}</span>
                      <span>${product.price}</span>
                    </Button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Your Cart ({cart.length} items)</CardTitle>
            </CardHeader>
            <CardContent>
              {cart.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <ScanLine className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Start scanning items to add them to your cart</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead>Qty</TableHead>
                        <TableHead>Price</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {cart.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>
                            <div>
                              <div className="font-medium">{item.name}</div>
                              <div className="text-sm text-gray-500">{item.sku}</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => updateQuantity(item.id, item.quantity - 1)}
                              >
                                <Minus className="h-3 w-3" />
                              </Button>
                              <span className="w-8 text-center">{item.quantity}</span>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => updateQuantity(item.id, item.quantity + 1)}
                              >
                                <Plus className="h-3 w-3" />
                              </Button>
                            </div>
                          </TableCell>
                          <TableCell>${(item.price * item.quantity).toFixed(2)}</TableCell>
                          <TableCell>
                            <Button size="sm" variant="ghost" onClick={() => removeItem(item.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  <Separator />

                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Subtotal:</span>
                      <span>${getTotal().toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Tax (8%):</span>
                      <span>${getTax().toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-lg">
                      <span>Total:</span>
                      <span>${getFinalTotal().toFixed(2)}</span>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <Button
                      className="w-full"
                      size="lg"
                      onClick={() => handlePayment("card")}
                      disabled={isProcessingPayment}
                    >
                      <CreditCard className="h-4 w-4 mr-2" />
                      {isProcessingPayment ? "Processing..." : "Pay with Card"}
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full"
                      size="lg"
                      onClick={() => handlePayment("cash")}
                      disabled={isProcessingPayment}
                    >
                      <DollarSign className="h-4 w-4 mr-2" />
                      Pay with Cash
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="mt-8">
          <CardContent className="pt-6">
            <div className="text-center space-y-2">
              <h3 className="font-medium">Need Help?</h3>
              <p className="text-sm text-gray-600">
                Cannot find a barcode? Having trouble scanning? Press the call button or ask any staff member for
                assistance.
              </p>
              <Button variant="outline" className="mt-4">
                Call for Assistance
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
