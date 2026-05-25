import { useStore } from '@/store/useStore'
import TopBar from '../TopBar'
import { Search, Filter, XCircle, Clock } from 'lucide-react'

export default function Orders() {
  const { trades } = useStore()
  const pendingOrders = trades.filter(t => t.status === 'pending')
  const orderHistory = trades.filter(t => t.status === 'closed')

  return (
    <div className="p-6 min-h-full">
      <TopBar title="Orders" subtitle="View and manage your trading orders" />

      <div className="panel-surface overflow-hidden">
        <div className="p-4 border-b border-[rgba(255,255,255,0.05)] flex items-center justify-between bg-[rgba(255,255,255,0.02)]">
          <div className="flex items-center gap-6">
            <button className="text-xs font-bold text-[#fafafa] border-b-2 border-[#22c55e] pb-4 -mb-4 uppercase tracking-widest">Active Orders</button>
            <button className="text-xs font-bold text-[#52525b] hover:text-[#a1a1aa] pb-4 -mb-4 uppercase tracking-widest">Order History</button>
            <button className="text-xs font-bold text-[#52525b] hover:text-[#a1a1aa] pb-4 -mb-4 uppercase tracking-widest">AI Orders</button>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#52525b]" />
              <input
                type="text"
                placeholder="Search orders..."
                className="bg-[#1f1f1f] border border-[rgba(255,255,255,0.08)] rounded-lg pl-9 pr-4 py-1.5 text-xs text-[#fafafa] outline-none focus:border-[rgba(34,197,94,0.3)] w-48"
              />
            </div>
            <button className="p-2 rounded-lg bg-[#1f1f1f] border border-[rgba(255,255,255,0.08)] text-[#a1a1aa] hover:text-[#fafafa]">
              <Filter size={14} />
            </button>
            <button className="px-3 py-1.5 rounded-lg bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.2)] text-[10px] text-[#ef4444] font-bold uppercase tracking-widest hover:bg-[rgba(239,68,68,0.2)] transition-all">
              Cancel All
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-[#52525b] border-b border-[rgba(255,255,255,0.05)]">
                <th className="px-6 py-4 font-medium">Pair</th>
                <th className="px-6 py-4 font-medium">Type</th>
                <th className="px-6 py-4 font-medium">Side</th>
                <th className="px-6 py-4 font-medium">Size</th>
                <th className="px-6 py-4 font-medium">Price</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium">Placed</th>
                <th className="px-6 py-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgba(255,255,255,0.05)]">
              {pendingOrders.length > 0 ? pendingOrders.map((order) => (
                <tr key={order.id} className="hover:bg-[rgba(255,255,255,0.02)] transition-colors">
                  <td className="px-6 py-4 font-medium text-[#fafafa]">{order.symbol}</td>
                  <td className="px-6 py-4 text-[#a1a1aa]">Limit</td>
                  <td className="px-6 py-4">
                    <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold uppercase ${order.side === 'buy' ? 'bg-[rgba(34,197,94,0.1)] text-[#22c55e]' : 'bg-[rgba(239,68,68,0.1)] text-[#ef4444]'}`}>
                      {order.side}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-[#a1a1aa] font-mono-data">{order.quantity}</td>
                  <td className="px-6 py-4 text-[#fafafa] font-mono-data">$${order.price.toLocaleString()}</td>
                  <td className="px-6 py-4">
                    <span className="flex items-center gap-1.5 text-gold">
                      <Clock size={12} />
                      Open
                    </span>
                  </td>
                  <td className="px-6 py-4 text-[#52525b] font-mono-data">{new Date(order.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                  <td className="px-6 py-4 text-right">
                    <button className="p-1.5 rounded-lg hover:bg-[rgba(239,68,68,0.1)] text-[#ef4444] transition-colors">
                      <XCircle size={16} />
                    </button>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center">
                    <p className="text-sm text-[#52525b]">No active orders</p>
                    <p className="text-[10px] text-[#52525b] uppercase tracking-widest mt-1">AI is managing orders automatically based on market conditions</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
