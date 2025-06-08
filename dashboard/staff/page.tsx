"use client"
import { useEffect, useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
  Users,
  Package,
  BarChart3,
  CheckCircle,
  AlertCircle,
  Wifi,
  WifiOff,
} from "lucide-react"
import DashboardLayout from "@/components/dashboard-layout"
import { InventoryTab } from "@/components/inventory-tab"
import { ReportsTab } from "@/components/reports-tab"
import { useDataStore, type CartItem } from "@/lib/data-store"

// ESP8266 WebSocket connection settings
const ESP_WEBSOCKET_URL = "ws://esp8266-scanner.local:81"

function StaffCheckout() {
  const { products, updateProductQuantity } = useDataStore()
  const [cart, setCart] = useState<CartItem[]>([])
  const [scanInput, setScanInput] = useState("")
  const [customerName, setCustomerName] = useState("")
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
          console.log("Staff terminal connected to ESP8266 scanner")
          setScannerConnected(true)
          setScannerStatus("connected")
        }

        ws.onmessage = (event) => {
          const scannedCode = event.data
          console.log("Staff terminal received barcode:", scannedCode)
          setLastScannedCode(scannedCode)
          handleScan(scannedCode)
        }

        ws.onclose = () => {
          console.log("Staff terminal disconnected from ESP8266 scanner")
          setScannerConnected(false)
          setScannerStatus("disconnected")
          // Try to reconnect after 5 seconds
          setTimeout(connectWebSocket, 5000)
        }

        ws.onerror = (error) => {
          console.error("Staff terminal WebSocket error:", error)
          setScannerConnected(false)
          setScannerStatus("disconnected")
        }

        websocketRef.current = ws
      } catch (error) {
        console.error("Staff terminal failed to connect to ESP8266:", error)
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
    return getTotal() * 0.08 // 8% tax
  }

  const getFinalTotal = () => {
    return getTotal() + getTax()
  }

  const handlePayment = async (method: "card" | "cash") => {
    // Remove the customer name requirement for staff checkout
    setIsProcessingPayment(true)
    setPaymentSuccess(false)
    setScanError("")

    // Simulate payment processing
    await new Promise((resolve) => setTimeout(resolve, 2000))

    // Update inventory quantities
    cart.forEach((item) => {
      updateProductQuantity(item.id, -item.quantity)
    })

    // Show success state
    setPaymentTotal(getFinalTotal())
    setPaymentSuccess(true)
    setIsProcessingPayment(false)

    // Auto-reset after 5 seconds
    setTimeout(() => {
      setCart([])
      setCustomerName("")
      setPaymentSuccess(false)
      setPaymentTotal(0)
    }, 5000)
  }

  const startNewTransaction = () => {
    setCart([])
    setCustomerName("")
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
      console.log("Staff terminal reconnected to ESP8266 scanner")
      setScannerConnected(true)
      setScannerStatus("connected")
    }

    ws.onmessage = (event) => {
      const scannedCode = event.data
      console.log("Staff terminal received barcode:", scannedCode)
      setLastScannedCode(scannedCode)
      handleScan(scannedCode)
    }

    ws.onclose = () => {
      console.log("Staff terminal disconnected from ESP8266 scanner")
      setScannerConnected(false)
      setScannerStatus("disconnected")
    }

    ws.onerror = (error) => {
      console.error("Staff terminal WebSocket error:", error)
      setScannerConnected(false)
      setScannerStatus("disconnected")
    }

    websocketRef.current = ws
  }

  // Payment Success State
  if (paymentSuccess) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card className="border-green-200 bg-green-50">
          <CardContent className="pt-6">
            <div className="text-center space-y-6">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-green-900">Payment Successful!</h1>
                <p className="text-green-700 mt-2">Transaction completed{customerName ? ` for ${customerName}` : ""}</p>
              </div>
              <div className="bg-white rounded-lg p-4 border border-green-200">
                <div className="text-3xl font-bold text-green-900">${paymentTotal.toFixed(2)}</div>
                <p className="text-sm text-green-600">Total Amount Paid</p>
              </div>
              <div className="space-y-2">
                <p className="text-sm text-green-700">Thank you for your business!</p>
                <p className="text-xs text-green-600">Starting new transaction in a few seconds...</p>
              </div>
              <Button onClick={startNewTransaction} className="bg-green-600 hover:bg-green-700">
                Start New Transaction
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Staff Checkout Terminal</h1>
        <p className="text-gray-600 mt-2">Assist customers with scanning and payment</p>
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
        {/* Customer & Scanning Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Customer Checkout
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
              <label className="text-sm font-medium">Customer Name (Optional)</label>
              <Input
                placeholder="Enter customer name (optional)..."
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
              />
            </div>

            <Separator />

            <div className="space-y-2">
              <label className="text-sm font-medium">Scan Items</label>
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
              <p className="text-xs text-gray-500">
                {scannerConnected
                  ? "Scanner ready - scan items or enter SKU manually"
                  : "Scanner disconnected - manual entry only"}
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Quick Add</label>
              <div className="grid grid-cols-1 gap-2">
                {products.slice(0, 4).map((product) => (
                  <Button
                    key={product.id}
                    variant="outline"
                    onClick={() => handleScan(product.sku)}
                    className="justify-between text-sm"
                  >
                    <span>{product.name}</span>
                    <span>${product.price}</span>
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Cart & Payment Section */}
        <Card>
          <CardHeader>
            <CardTitle>Shopping Cart ({cart.length} items)</CardTitle>
          </CardHeader>
          <CardContent>
            {cart.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <ScanLine className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Scan items to add them to the cart</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="max-h-64 overflow-y-auto">
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
                              <div className="font-medium text-sm">{item.name}</div>
                              <div className="text-xs text-gray-500">{item.sku}</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => updateQuantity(item.id, item.quantity - 1)}
                              >
                                <Minus className="h-3 w-3" />
                              </Button>
                              <span className="w-8 text-center text-sm">{item.quantity}</span>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => updateQuantity(item.id, item.quantity + 1)}
                              >
                                <Plus className="h-3 w-3" />
                              </Button>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">${(item.price * item.quantity).toFixed(2)}</TableCell>
                          <TableCell>
                            <Button size="sm" variant="ghost" onClick={() => removeItem(item.id)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

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
                    disabled={isProcessingPayment || cart.length === 0}
                  >
                    <CreditCard className="h-4 w-4 mr-2" />
                    {isProcessingPayment ? "Processing..." : "Process Card Payment"}
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full"
                    size="lg"
                    onClick={() => handlePayment("cash")}
                    disabled={isProcessingPayment || cart.length === 0}
                  >
                    <DollarSign className="h-4 w-4 mr-2" />
                    Process Cash Payment
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default function StaffDashboard() {
  const { user, isLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && (!user || user.role !== "staff")) {
      router.push("/")
    }
  }, [user, isLoading, router])

  if (isLoading || !user) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>
  }

  return (
    <DashboardLayout>
      <Tabs defaultValue="checkout" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="checkout" className="flex items-center gap-2">
            <ScanLine className="h-4 w-4" />
            Checkout
          </TabsTrigger>
          <TabsTrigger value="inventory" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Inventory
          </TabsTrigger>
          <TabsTrigger value="reports" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Reports
          </TabsTrigger>
        </TabsList>

        <TabsContent value="checkout">
          <StaffCheckout />
        </TabsContent>

        <TabsContent value="inventory">
          <InventoryTab />
        </TabsContent>

        <TabsContent value="reports">
          <ReportsTab />
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  )
}
