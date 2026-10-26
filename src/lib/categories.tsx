import {
  Baby, Bus, Car, Dumbbell, Gift, GraduationCap, HeartPulse, Home, Package, PartyPopper,
  PawPrint, Plane, Shirt, ShoppingCart, Smartphone, Utensils, Wallet, type LucideIcon,
} from "lucide-react";

export const ICONS: Record<string, LucideIcon> = {
  cart: ShoppingCart,
  food: Utensils,
  education: GraduationCap,
  party: PartyPopper,
  home: Home,
  car: Car,
  health: HeartPulse,
  bus: Bus,
  clothes: Shirt,
  pet: PawPrint,
  phone: Smartphone,
  gift: Gift,
  travel: Plane,
  gym: Dumbbell,
  baby: Baby,
  package: Package,
  wallet: Wallet,
};

export const COLORS = [
  "#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6",
  "#ec4899", "#14b8a6", "#f97316", "#6366f1", "#84cc16", "#64748b",
];

export function CategoryIcon({ icon, color, className = "size-4" }: { icon: string; color?: string; className?: string }) {
  const Icon = ICONS[icon] ?? Wallet;
  return <Icon className={className} style={color ? { color } : undefined} aria-hidden />;
}

export function CategoryBadge({ icon, color, size = "md" }: { icon: string; color: string; size?: "sm" | "md" }) {
  const box = size === "sm" ? "size-8" : "size-10";
  return (
    <span
      className={`${box} inline-flex shrink-0 items-center justify-center rounded-xl`}
      style={{ backgroundColor: `${color}1f` }}
    >
      <CategoryIcon icon={icon} color={color} className={size === "sm" ? "size-4" : "size-5"} />
    </span>
  );
}

export const DEFAULT_CATEGORIES = [
  { name: "Alimentação", icon: "cart", color: "#10b981", subcategories: ["Mercado", "Padaria", "Açougue", "Feira", "Restaurante", "Delivery"] },
  { name: "Casa", icon: "home", color: "#3b82f6", subcategories: ["Água", "Luz", "Telefone/Internet", "Gás", "Aluguel", "Condomínio", "Manutenção"] },
  { name: "Automóvel", icon: "car", color: "#f59e0b", subcategories: ["Combustível", "Manutenção", "Seguro", "IPVA", "Estacionamento"] },
  { name: "Educação", icon: "education", color: "#8b5cf6", subcategories: ["Mensalidade", "Material", "Cursos", "Livros"] },
  { name: "Lazer", icon: "party", color: "#ec4899", subcategories: ["Passeios", "Streaming", "Viagem", "Bares"] },
  { name: "Saúde", icon: "health", color: "#ef4444", subcategories: ["Farmácia", "Plano de saúde", "Consultas", "Exames"] },
  { name: "Transporte", icon: "bus", color: "#14b8a6", subcategories: ["Ônibus", "Aplicativo", "Táxi"] },
  { name: "Outros", icon: "package", color: "#64748b", subcategories: [] },
];
