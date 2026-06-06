// icons.jsx — re-export centralizado de íconos de lucide-react.
// Importar SOLO desde este módulo para que el tree-shaking sea consistente
// y mantengamos el bundle chico (cada ícono ~700 bytes minificado).
//
// Defaults visuales: stroke 1.75, size 18. Suficiente densidad sin "peso"
// gráfico en el tema blanco staff. Override por instancia si hace falta.
export {
  // Branding / generales
  Leaf,
  // Acciones de cocina/cobro
  UtensilsCrossed,
  Banknote,
  Smartphone,
  Camera,
  // Estados
  Check,
  CheckCircle2,
  X,
  XCircle,
  Ban,
  Flag,
  Info,
  AlertTriangle,
  Eye,
  Pause,
  // Notificaciones
  Bell,
  BellOff,
  BellRing,
  // Usuario / staff
  User,
  UserPlus,
  UserCheck,
  UserMinus,
  Key,
  Repeat,
  // Navegación
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  // PWA
  Download,
  RefreshCw,
  Share2,
  // Búsqueda / acciones
  Search,
  Plus,
  Trash2,
  Link2,
} from 'lucide-react';

export const ICON_SIZE = 18;
export const ICON_STROKE = 1.75;
