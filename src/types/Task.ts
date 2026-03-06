export interface ForecastData {
    month: string;
    actual: number | null;
    forecast: number | null;
}

export interface Advice {
    title: string;
    content: string;
    priority: 'HIGH' | 'MEDIUM' | 'INFO';
}

export interface SalesStrategy {
    id: string;
    month: string;
    title: string;
    content: string;
    priority: string;
    category: string;
    status: string;
    createdAt: Date;
}
