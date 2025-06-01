export class NamingUtils {
  static getApiServiceName(instanceId: string): string {
    return `wweb-${instanceId}-api`;
  }

  static getMcpServiceName(instanceId: string): string {
    return `wweb-${instanceId}-mcp`;
  }

  static getApiContainerName(instanceId: string): string {
    return `wweb-${instanceId}-api`;
  }

  static getMcpContainerName(instanceId: string): string {
    return `wweb-${instanceId}-mcp`;
  }

  static getComposeProjectName(instanceId: string): string {
    return `wweb-${instanceId}`;
  }

  static getAuthVolumeName(instanceId: string): string {
    return `wweb-auth-${instanceId}`;
  }

  static getComposeFilePath(instanceId: string): string {
    return `composes/docker-compose-${instanceId}.yml`;
  }

  static getDisplayName(provider: string, typeInstance: string[]): string {
    const types = typeInstance.join('_');
    return `${provider}_${types}`;
  }

  static getApiWebhookName(instanceId: string): string {
    return `webhook-${instanceId}`;
  }

  static getMcpName(instanceId: string): string {
    return `mcp-${instanceId}`;
  }

  static getNetworkName(instanceId: string): string {
    return `wweb-${instanceId}`;
  }

  static getDockerLabels(
    instanceId: string,
    userId: string,
    provider: string,
    type: string,
  ): Record<string, string> {
    return {
      'wweb.instance.id': instanceId,
      'wweb.instance.type': type,
      'wweb.instance.provider': provider,
      'wweb.instance.user_id': userId,
    };
  }
}
