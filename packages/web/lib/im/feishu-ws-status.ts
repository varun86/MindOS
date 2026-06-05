type FeishuWSStatus = {
  running: boolean;
  startedAt?: string;
  lastError?: string;
};

let status: FeishuWSStatus = {
  running: false,
};

export function getFeishuWSClientStatus(): FeishuWSStatus {
  return { ...status };
}

export function setFeishuWSClientStatus(nextStatus: FeishuWSStatus): void {
  status = { ...nextStatus };
}

export function __resetFeishuWSClientStatusForTests(): void {
  status = {
    running: false,
  };
}
