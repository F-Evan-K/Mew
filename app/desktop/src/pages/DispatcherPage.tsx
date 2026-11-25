import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Operator } from "../model/operator";
import { ORDER_STATUSES, OrderItem, OrderStatus, distance, statusLabel } from "../model/order-item";
import Button from "../components/Button";
import OperatorIcon from "../components/OperatorIcon";
import Panel from "../components/Panel";
import StatusMark from "../components/StatusMark";

type Props = { couriers: Operator[]; items: OrderItem[] };

// Courier recommendation: bobot weighted scoring (total = 1)
const DISTANCE_WEIGHT = 0.7;
const SPECIALTY_WEIGHT = 0.3;

export default function DispatcherPage({ couriers, items }: Props) {
    const [status, setStatus] = useState<OrderStatus>("READY_FOR_PICKUP");
    const [itemId, setItemId] = useState<number | null>(null);
    const [courierId, setCourierId] = useState<number | null>(null);
    const [message, setMessage] = useState<string | null>(null);

    const shown = items.filter((item) => item.status === status);
    const item = items.find((i) => i.id === itemId && i.status === "READY_FOR_PICKUP") ?? null;
    const courier = couriers.find((c) => c.id === courierId && c.availability === 1) ?? null;

    function range(c: Operator) {
        return item ? distance(c.x_position, c.y_position, item.pickup.x_position, item.pickup.y_position) : 0;
    }

    const availableCouriers = couriers.filter((c) => c.availability === 1);
    const maxRange = Math.max(0, ...availableCouriers.map(range));

    function score(c: Operator) {
        if (!item) return 0;
        const distanceScore = maxRange === 0 ? 1 : 1 - range(c) / maxRange;
        const specialtyScore = c.region_specialty === item.pickup_region ? 1 : 0;
        return DISTANCE_WEIGHT * distanceScore + SPECIALTY_WEIGHT * specialtyScore;
    }

    // available di atas, lalu skor tertinggi; tanpa item terpilih urutan tetap
    const ranked = item
        ? [...couriers].sort((a, b) => b.availability - a.availability || score(b) - score(a))
        : couriers;

    async function assign() {
        if (!item || !courier) return;
        try {
            await invoke("dispatch_operator", { operator_id: courier.id, order_item_id: item.id });
            setMessage(`${courier.codename} assigned to order item #${item.id}`);
            setItemId(null);
            setCourierId(null);
        } catch (err) {
            setMessage(String(err));
        }
    }

    return (
        <div className="grid h-full grid-cols-[1fr_360px] gap-4">
            <Panel
                code="D-01"
                title="Order Items"
                aside={<span className="font-mono text-[10px] text-steel">{items.length} TOTAL</span>}
            >
                <div className="sticky top-0 z-10 grid grid-cols-6 border-b border-ash/40 bg-slate">
                    {ORDER_STATUSES.map((s) => (
                        <button
                            key={s}
                            onClick={() => setStatus(s)}
                            className={`border-b-2 px-3 py-3 text-left transition-colors ${
                                s === status ? "border-signal bg-ash/20" : "border-transparent hover:bg-ash/10"
                            }`}
                        >
                            <span className="block text-2xl font-bold">
                                {items.filter((i) => i.status === s).length}
                            </span>
                            <span className="block font-mono text-[10px] leading-tight text-steel">
                                {statusLabel(s)}
                            </span>
                        </button>
                    ))}
                </div>

                <table className="w-full text-sm">
                    <thead className="font-mono text-[10px] tracking-[0.2em] text-ash">
                        <tr className="text-left">
                            <th className="px-4 py-2 font-normal">ID</th>
                            <th className="px-2 py-2 font-normal">MEDICINE</th>
                            <th className="px-2 py-2 text-right font-normal">QTY</th>
                            <th className="px-2 py-2 font-normal">PICKUP</th>
                            <th className="px-2 py-2 font-normal">DESTINATION</th>
                            <th className="px-4 py-2 font-normal">COURIER</th>
                        </tr>
                    </thead>
                    <tbody>
                        {shown.map((i) => {
                            const selectable = i.status === "READY_FOR_PICKUP";
                            const selected = i.id === item?.id;
                            return (
                                <tr
                                    key={i.id}
                                    onClick={() => selectable && setItemId(selected ? null : i.id)}
                                    className={`border-t border-l-4 border-t-ash/20 ${selected ? "border-l-signal bg-ash/25" : "border-l-transparent"} ${
                                        selectable ? "cursor-pointer hover:bg-ash/15" : ""
                                    }`}
                                >
                                    <td className="px-4 py-2.5 font-mono text-steel">#{i.id}</td>
                                    <td className="px-2 py-2.5 font-semibold">{i.medicine_name}</td>
                                    <td className="px-2 py-2.5 text-right font-mono">{i.quantity}</td>
                                    <td className="px-2 py-2.5 text-steel">{i.pickup.name}</td>
                                    <td className="px-2 py-2.5 text-steel">{i.destination.name}</td>
                                    <td className="px-4 py-2.5 font-mono text-xs uppercase">
                                        {i.courier_codename ?? "-"}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
                {shown.length === 0 && (
                    <p className="p-10 text-center font-mono text-xs tracking-widest text-ash">
                        NO ORDER ITEM IN THIS STATUS
                    </p>
                )}
            </Panel>

            <Panel
                code="D-02"
                title="Couriers"
                aside={
                    <span className="font-mono text-[10px] text-steel">
                        {couriers.filter((c) => c.availability === 1).length}/{couriers.length} READY
                    </span>
                }
                footer={
                    <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-px bg-ash/40 font-mono text-xs">
                            <div className="bg-slate pr-3">
                                <p className="text-[10px] text-ash">ORDER ITEM</p>
                                <p className="truncate">
                                    {item ? `#${item.id} ${item.medicine_name}` : "Select ready item"}
                                </p>
                            </div>
                            <div className="bg-slate pl-3">
                                <p className="text-[10px] text-ash">COURIER</p>
                                <p className="truncate uppercase">{courier ? courier.codename : "Select courier"}</p>
                            </div>
                        </div>
                        <Button className="w-full" disabled={!item || !courier} onClick={assign}>
                            Assign Courier
                        </Button>
                        {message && <p className="font-mono text-[11px] text-steel">{message}</p>}
                    </div>
                }
            >
                <ul>
                    {ranked.map((c) => {
                        const available = c.availability === 1;
                        const selected = c.id === courier?.id;
                        return (
                            <li key={c.id}>
                                <button
                                    disabled={!available}
                                    onClick={() => setCourierId(selected ? null : c.id)}
                                    className={`flex w-full items-center gap-3 border-b border-l-4 border-b-ash/20 px-4 py-2.5 text-left ${
                                        selected ? "border-l-signal bg-ash/25" : "border-l-transparent hover:bg-ash/15"
                                    } ${available ? "" : "opacity-40"}`}
                                >
                                    <OperatorIcon operator={c} />
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate text-sm font-semibold tracking-wider uppercase">
                                            {c.codename}
                                        </span>
                                        <StatusMark status={available ? "AVAILABLE" : "ON_DUTY"} />
                                    </span>
                                    <span className="text-right font-mono text-[10px] text-steel">
                                        {item && available ? (
                                            <span className="text-sm text-signal">
                                                {(score(c) * 100).toFixed(0)}% · {range(c).toFixed(0)}
                                            </span>
                                        ) : (
                                            c.region_specialty
                                        )}
                                        <span className="block text-ash">
                                            {item && available ? "SCORE · DIST" : "SPECIALTY"}
                                        </span>
                                    </span>
                                </button>
                            </li>
                        );
                    })}
                </ul>
            </Panel>
        </div>
    );
}
