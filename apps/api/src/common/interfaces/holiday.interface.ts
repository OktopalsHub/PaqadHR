export interface Holiday {
    id: string;
    name: string;
    date: string;
    type: 'national' | 'religious' | 'custom';
    recurring: boolean;
}
