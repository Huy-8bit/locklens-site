import {
  Activity, Bell, Boxes, Building2, CalendarClock, ChartColumn, ChartLine, Combine, Cpu, CreditCard, Database, FileText, GitBranch, Gauge,
  Globe, KeyRound, Layers, Lightbulb, ListTree, Lock, Megaphone, Microscope, Monitor, Network, Package, Radar, Receipt, Repeat, Router,
  Rss, Satellite, Send, Server, Shield, ShieldCheck, ShoppingCart, Siren, Smartphone, Split, Terminal, UserRound, Users, Waypoints, Workflow, Zap,
} from 'lucide-react';

export const ICONS = {
  Activity, Bell, Boxes, Building2, CalendarClock, ChartColumn, ChartLine, Combine, Cpu, CreditCard, Database, FileText, GitBranch, Gauge,
  Globe, KeyRound, Layers, Lightbulb, ListTree, Lock, Megaphone, Microscope, Monitor, Network, Package, Radar, Receipt, Repeat, Router,
  Rss, Satellite, Send, Server, Shield, ShieldCheck, ShoppingCart, Siren, Smartphone, Split, Terminal, UserRound, Users, Waypoints, Workflow, Zap,
};
export type IconName = keyof typeof ICONS;
export const icon = (name: string) => ICONS[name as IconName] ?? ICONS.Boxes;
