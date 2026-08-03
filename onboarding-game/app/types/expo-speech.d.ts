declare module "expo-speech" {
  export type SpeakOptions = {
    language?: string;
    rate?: number;
    pitch?: number;
    volume?: number;
    voice?: string;
    onStart?: () => void;
    onDone?: () => void;
    onStopped?: () => void;
    onError?: (error: unknown) => void;
  };

  export function speak(text: string, options?: SpeakOptions): void;
  export function stop(): void;
  export function isSpeakingAsync(): Promise<boolean>;
  export function getAvailableVoicesAsync(): Promise<
    Array<{ identifier?: string; name?: string; quality?: number; language?: string }>
  >;
}
