import {
  SocketIOApi,
  SystemConfig,
  ProgressUpdate,
  IntermediateResult,
  GenerationParameters,
  GenerationResult,
} from '@invoke/api';
import { EventEmitter } from 'events';
import {
  FACETOOL_TYPES,
  HEIGHTS,
  IN_PROGRESS_IMAGE_TYPES,
  NUMPY_RAND_MAX,
  NUMPY_RAND_MIN,
  SAMPLERS,
  WIDTHS,
} from '@invoke/core';

export default class SocketIOApiWrapper extends EventEmitter {
  public readonly api: SocketIOApi;
  private systemConfig?: SystemConfig;

  private _progress?: ProgressUpdate;
  private _intermediate?: IntermediateResult;
  private _statusMessage = 'Disconnected';

  public get isProcessing(): boolean {
    return this.progress?.isProcessing ?? false;
  }

  public get connected(): boolean {
    return this.api.socket.connected;
  }

  public get progress(): ProgressUpdate | undefined {
    return this._progress;
  }
  private set progress(value: ProgressUpdate | undefined) {
    this._progress = value;
  }

  public get intermediate(): IntermediateResult | undefined {
    return this._intermediate;
  }
  private set intermediate(value: IntermediateResult | undefined) {
    this._intermediate = value;
  }

  public get statusMessage(): string {
    return this._statusMessage;
  }
  private set statusMessage(value: string) {
    this._statusMessage = value;
  }

  constructor(private readonly url: string) {
    super();
    this.api = new SocketIOApi(url);
    this.api.onConnect(() => {
      this.progress = undefined;
      this.intermediate = undefined;
      this.statusMessage = 'Connected';
    });
    this.api.onProgressUpdate((progress) => {
      this.progress = progress;
      this.statusMessage = progress.currentStatus;
      if (progress.isProcessing && progress.currentIteration > 1) {
        this.statusMessage += ` (${progress.currentIteration}/${progress.totalIterations})`;
      }
    });
    this.api.onIntermediateResult((result) => {
      this.intermediate = result;
    });
    this.api.onProcessingCanceled(() => {
      this.progress = undefined;
      this.intermediate = undefined;
      this.statusMessage = 'Processing canceled';
    });
    this.api.onModelChanged(() => {
      this.progress = undefined;
      this.intermediate = undefined;
      this.statusMessage = 'Model Changed';
    });
    this.api.onDisconnect(() => {
      this.progress = undefined;
      this.intermediate = undefined;
      this.statusMessage = 'Disconnected';
    });
  }

  public async getSystemConfig(): Promise<SystemConfig> {
    return await this.api.requestSystemConfig();
  }

  public async getImages(type: 'user' | 'result', mtime?: number) {
    return await this.api.requestImages(type, mtime);
  }

  public getImage(path: string): string {
    return `${this.url}/${path}`;
  }

  public async generate(
    _config: Partial<GenerationConfig>,
  ): Promise<GenerationResult> {
    if (!this.systemConfig) {
      this.systemConfig = await this.getSystemConfig();
    }
    const config = { ...DefaultGenerationConfig, ..._config };
    const parameter: GenerationParameters = {
      prompt: config.prompt,
      iterations: config.images,
      steps: config.steps,
      cfg_scale: config.cfg_scale,
      threshold: config.threshold,
      perlin: config.perlin_noise,
      height: config.height,
      width: config.width,
      sampler_name: config.sampler,
      seed: _config.seed ?? generateSeed(),
      progress_images: config.display_inprogress.type.value === 'full-res',
      progress_latents: config.display_inprogress.type.value === 'latents',
      save_intermediates: config.display_inprogress.interval,
      generation_mode: 'txt2img',
      init_mask: '',
      seamless: config.seamless_tiling,
      hires_fix: config.hires_fix,
      variation_amount: config.variation_amount,
    };
    this.api.generateImage(parameter, config.upscale, config.restore_face);
    return await this.api.onceGenerationResultAsync();
  }

  public cancelGeneration(): void {
    this.api.cancel();
  }

  public forceSetProgress(progress: ProgressUpdate): void {
    this.progress = progress;
  }
}

export type valueOf<T extends ReadonlyArray<unknown>> = T extends ReadonlyArray<
  infer ElementType
>
  ? ElementType
  : never;

export interface GenerationConfig {
  prompt: string;
  images: number;
  steps: number;
  cfg_scale: number;
  width: valueOf<typeof WIDTHS>;
  height: valueOf<typeof HEIGHTS>;
  sampler: valueOf<typeof SAMPLERS>;
  seed: number;
  threshold: number;
  perlin_noise: number;
  variation_amount: number;
  seamless_tiling: boolean;
  hires_fix: boolean;
  display_inprogress: {
    type: valueOf<typeof IN_PROGRESS_IMAGE_TYPES>;
    interval: number;
  };
  upscale?: {
    level: number;
    strength: number;
  };
  restore_face?: {
    strength: number;
    type: valueOf<typeof FACETOOL_TYPES>;
  };
}

export const DefaultGenerationConfig: GenerationConfig = {
  prompt: '',
  images: 1,
  steps: 50,
  cfg_scale: 7.5,
  width: 512,
  height: 512,
  sampler: 'k_lms',
  seed: Math.floor(
    Math.random() * (NUMPY_RAND_MAX - NUMPY_RAND_MIN + 1) + NUMPY_RAND_MIN,
  ),
  threshold: 0,
  perlin_noise: 0,
  variation_amount: 0,
  seamless_tiling: false,
  hires_fix: true,
  display_inprogress: {
    type: IN_PROGRESS_IMAGE_TYPES[1],
    interval: 5,
  },
  upscale: undefined,
  restore_face: undefined,
};

function generateSeed() {
  return Math.floor(
    Math.random() * (NUMPY_RAND_MAX - NUMPY_RAND_MIN + 1) + NUMPY_RAND_MIN,
  );
}
