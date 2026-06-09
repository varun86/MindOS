declare module '@juicesharp/rpiv-ask-user-question' {
  import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';

  export default function registerAskUserQuestionExtension(pi: ExtensionAPI): void | Promise<void>;
}
