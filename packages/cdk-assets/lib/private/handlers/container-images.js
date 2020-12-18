"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContainerImageAssetHandler = void 0;
const path = require("path");
const progress_1 = require("../../progress");
const docker_1 = require("../docker");
const placeholders_1 = require("../placeholders");
class ContainerImageAssetHandler {
    constructor(workDir, asset, host) {
        this.workDir = workDir;
        this.asset = asset;
        this.host = host;
        this.docker = new docker_1.Docker(m => this.host.emitMessage(progress_1.EventType.DEBUG, m));
        this.localTagName = `cdkasset-${this.asset.id.assetId.toLowerCase()}`;
    }
    async publish() {
        const destination = await placeholders_1.replaceAwsPlaceholders(this.asset.destination, this.host.aws);
        const ecr = await this.host.aws.ecrClient(destination);
        const account = (await this.host.aws.discoverCurrentAccount()).accountId;
        const repoUri = await repositoryUri(ecr, destination.repositoryName);
        if (!repoUri) {
            throw new Error(`No ECR repository named '${destination.repositoryName}' in account ${account}. Is this account bootstrapped?`);
        }
        const imageUri = `${repoUri}:${destination.imageTag}`;
        this.host.emitMessage(progress_1.EventType.CHECK, `Check ${imageUri}`);
        if (await imageExists(ecr, destination.repositoryName, destination.imageTag)) {
            this.host.emitMessage(progress_1.EventType.FOUND, `Found ${imageUri}`);
            return;
        }
        if (this.host.aborted) {
            return;
        }
        // Login before build so that the Dockerfile can reference images in the ECR repo
        await this.docker.login(ecr);
        await this.buildImage();
        this.host.emitMessage(progress_1.EventType.UPLOAD, `Push ${imageUri}`);
        if (this.host.aborted) {
            return;
        }
        await this.docker.tag(this.localTagName, imageUri);
        await this.docker.push(imageUri);
    }
    async buildImage() {
        if (await this.docker.exists(this.localTagName)) {
            this.host.emitMessage(progress_1.EventType.CACHED, `Cached ${this.localTagName}`);
            return;
        }
        const source = this.asset.source;
        const fullPath = path.resolve(this.workDir, source.directory);
        this.host.emitMessage(progress_1.EventType.BUILD, `Building Docker image at ${fullPath}`);
        await this.docker.build({
            directory: fullPath,
            tag: this.localTagName,
            buildArgs: source.dockerBuildArgs,
            target: source.dockerBuildTarget,
            file: source.dockerFile,
        });
    }
}
exports.ContainerImageAssetHandler = ContainerImageAssetHandler;
async function imageExists(ecr, repositoryName, imageTag) {
    try {
        await ecr.describeImages({ repositoryName, imageIds: [{ imageTag }] }).promise();
        return true;
    }
    catch (e) {
        if (e.code !== 'ImageNotFoundException') {
            throw e;
        }
        return false;
    }
}
/**
 * Return the URI for the repository with the given name
 *
 * Returns undefined if the repository does not exist.
 */
async function repositoryUri(ecr, repositoryName) {
    var _a;
    try {
        const response = await ecr.describeRepositories({ repositoryNames: [repositoryName] }).promise();
        return (_a = (response.repositories || [])[0]) === null || _a === void 0 ? void 0 : _a.repositoryUri;
    }
    catch (e) {
        if (e.code !== 'RepositoryNotFoundException') {
            throw e;
        }
        return undefined;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29udGFpbmVyLWltYWdlcy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImNvbnRhaW5lci1pbWFnZXMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEsNkJBQTZCO0FBRTdCLDZDQUEyQztBQUUzQyxzQ0FBbUM7QUFDbkMsa0RBQXlEO0FBRXpELE1BQWEsMEJBQTBCO0lBSXJDLFlBQ21CLE9BQWUsRUFDZixLQUErQixFQUMvQixJQUFrQjtRQUZsQixZQUFPLEdBQVAsT0FBTyxDQUFRO1FBQ2YsVUFBSyxHQUFMLEtBQUssQ0FBMEI7UUFDL0IsU0FBSSxHQUFKLElBQUksQ0FBYztRQUxwQixXQUFNLEdBQUcsSUFBSSxlQUFNLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxvQkFBUyxDQUFDLEtBQUssRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBT25GLElBQUksQ0FBQyxZQUFZLEdBQUcsWUFBWSxJQUFJLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxPQUFPLENBQUMsV0FBVyxFQUFFLEVBQUUsQ0FBQztJQUN4RSxDQUFDO0lBRU0sS0FBSyxDQUFDLE9BQU87UUFDbEIsTUFBTSxXQUFXLEdBQUcsTUFBTSxxQ0FBc0IsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLFdBQVcsRUFBRSxJQUFJLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDO1FBRXhGLE1BQU0sR0FBRyxHQUFHLE1BQU0sSUFBSSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLFdBQVcsQ0FBQyxDQUFDO1FBRXZELE1BQU0sT0FBTyxHQUFHLENBQUMsTUFBTSxJQUFJLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxzQkFBc0IsRUFBRSxDQUFDLENBQUMsU0FBUyxDQUFDO1FBRXpFLE1BQU0sT0FBTyxHQUFHLE1BQU0sYUFBYSxDQUFDLEdBQUcsRUFBRSxXQUFXLENBQUMsY0FBYyxDQUFDLENBQUM7UUFDckUsSUFBSSxDQUFDLE9BQU8sRUFBRTtZQUNaLE1BQU0sSUFBSSxLQUFLLENBQUMsNEJBQTRCLFdBQVcsQ0FBQyxjQUFjLGdCQUFnQixPQUFPLGlDQUFpQyxDQUFDLENBQUM7U0FDakk7UUFFRCxNQUFNLFFBQVEsR0FBRyxHQUFHLE9BQU8sSUFBSSxXQUFXLENBQUMsUUFBUSxFQUFFLENBQUM7UUFFdEQsSUFBSSxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsb0JBQVMsQ0FBQyxLQUFLLEVBQUUsU0FBUyxRQUFRLEVBQUUsQ0FBQyxDQUFDO1FBQzVELElBQUksTUFBTSxXQUFXLENBQUMsR0FBRyxFQUFFLFdBQVcsQ0FBQyxjQUFjLEVBQUUsV0FBVyxDQUFDLFFBQVEsQ0FBQyxFQUFFO1lBQzVFLElBQUksQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLG9CQUFTLENBQUMsS0FBSyxFQUFFLFNBQVMsUUFBUSxFQUFFLENBQUMsQ0FBQztZQUM1RCxPQUFPO1NBQ1I7UUFFRCxJQUFJLElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFO1lBQUUsT0FBTztTQUFFO1FBRWxDLGlGQUFpRjtRQUNqRixNQUFNLElBQUksQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDO1FBQzdCLE1BQU0sSUFBSSxDQUFDLFVBQVUsRUFBRSxDQUFDO1FBRXhCLElBQUksQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLG9CQUFTLENBQUMsTUFBTSxFQUFFLFFBQVEsUUFBUSxFQUFFLENBQUMsQ0FBQztRQUM1RCxJQUFJLElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFO1lBQUUsT0FBTztTQUFFO1FBQ2xDLE1BQU0sSUFBSSxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLFlBQVksRUFBRSxRQUFRLENBQUMsQ0FBQztRQUNuRCxNQUFNLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDO0lBQ25DLENBQUM7SUFFTyxLQUFLLENBQUMsVUFBVTtRQUN0QixJQUFJLE1BQU0sSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxFQUFFO1lBQy9DLElBQUksQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLG9CQUFTLENBQUMsTUFBTSxFQUFFLFVBQVUsSUFBSSxDQUFDLFlBQVksRUFBRSxDQUFDLENBQUM7WUFDdkUsT0FBTztTQUNSO1FBRUQsTUFBTSxNQUFNLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUM7UUFFakMsTUFBTSxRQUFRLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLE1BQU0sQ0FBQyxTQUFTLENBQUMsQ0FBQztRQUM5RCxJQUFJLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxvQkFBUyxDQUFDLEtBQUssRUFBRSw0QkFBNEIsUUFBUSxFQUFFLENBQUMsQ0FBQztRQUUvRSxNQUFNLElBQUksQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDO1lBQ3RCLFNBQVMsRUFBRSxRQUFRO1lBQ25CLEdBQUcsRUFBRSxJQUFJLENBQUMsWUFBWTtZQUN0QixTQUFTLEVBQUUsTUFBTSxDQUFDLGVBQWU7WUFDakMsTUFBTSxFQUFFLE1BQU0sQ0FBQyxpQkFBaUI7WUFDaEMsSUFBSSxFQUFFLE1BQU0sQ0FBQyxVQUFVO1NBQ3hCLENBQUMsQ0FBQztJQUNMLENBQUM7Q0FDRjtBQS9ERCxnRUErREM7QUFFRCxLQUFLLFVBQVUsV0FBVyxDQUFDLEdBQVksRUFBRSxjQUFzQixFQUFFLFFBQWdCO0lBQy9FLElBQUk7UUFDRixNQUFNLEdBQUcsQ0FBQyxjQUFjLENBQUMsRUFBRSxjQUFjLEVBQUUsUUFBUSxFQUFFLENBQUMsRUFBRSxRQUFRLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxPQUFPLEVBQUUsQ0FBQztRQUNqRixPQUFPLElBQUksQ0FBQztLQUNiO0lBQUMsT0FBTyxDQUFDLEVBQUU7UUFDVixJQUFJLENBQUMsQ0FBQyxJQUFJLEtBQUssd0JBQXdCLEVBQUU7WUFBRSxNQUFNLENBQUMsQ0FBQztTQUFFO1FBQ3JELE9BQU8sS0FBSyxDQUFDO0tBQ2Q7QUFDSCxDQUFDO0FBRUQ7Ozs7R0FJRztBQUNILEtBQUssVUFBVSxhQUFhLENBQUMsR0FBWSxFQUFFLGNBQXNCOztJQUMvRCxJQUFJO1FBQ0YsTUFBTSxRQUFRLEdBQUcsTUFBTSxHQUFHLENBQUMsb0JBQW9CLENBQUMsRUFBRSxlQUFlLEVBQUUsQ0FBQyxjQUFjLENBQUMsRUFBRSxDQUFDLENBQUMsT0FBTyxFQUFFLENBQUM7UUFDakcsYUFBTyxDQUFDLFFBQVEsQ0FBQyxZQUFZLElBQUksRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLDBDQUFFLGFBQWEsQ0FBQztLQUN4RDtJQUFDLE9BQU8sQ0FBQyxFQUFFO1FBQ1YsSUFBSSxDQUFDLENBQUMsSUFBSSxLQUFLLDZCQUE2QixFQUFFO1lBQUUsTUFBTSxDQUFDLENBQUM7U0FBRTtRQUMxRCxPQUFPLFNBQVMsQ0FBQztLQUNsQjtBQUNILENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0IHsgRG9ja2VySW1hZ2VNYW5pZmVzdEVudHJ5IH0gZnJvbSAnLi4vLi4vYXNzZXQtbWFuaWZlc3QnO1xuaW1wb3J0IHsgRXZlbnRUeXBlIH0gZnJvbSAnLi4vLi4vcHJvZ3Jlc3MnO1xuaW1wb3J0IHsgSUFzc2V0SGFuZGxlciwgSUhhbmRsZXJIb3N0IH0gZnJvbSAnLi4vYXNzZXQtaGFuZGxlcic7XG5pbXBvcnQgeyBEb2NrZXIgfSBmcm9tICcuLi9kb2NrZXInO1xuaW1wb3J0IHsgcmVwbGFjZUF3c1BsYWNlaG9sZGVycyB9IGZyb20gJy4uL3BsYWNlaG9sZGVycyc7XG5cbmV4cG9ydCBjbGFzcyBDb250YWluZXJJbWFnZUFzc2V0SGFuZGxlciBpbXBsZW1lbnRzIElBc3NldEhhbmRsZXIge1xuICBwcml2YXRlIHJlYWRvbmx5IGxvY2FsVGFnTmFtZTogc3RyaW5nO1xuICBwcml2YXRlIHJlYWRvbmx5IGRvY2tlciA9IG5ldyBEb2NrZXIobSA9PiB0aGlzLmhvc3QuZW1pdE1lc3NhZ2UoRXZlbnRUeXBlLkRFQlVHLCBtKSk7XG5cbiAgY29uc3RydWN0b3IoXG4gICAgcHJpdmF0ZSByZWFkb25seSB3b3JrRGlyOiBzdHJpbmcsXG4gICAgcHJpdmF0ZSByZWFkb25seSBhc3NldDogRG9ja2VySW1hZ2VNYW5pZmVzdEVudHJ5LFxuICAgIHByaXZhdGUgcmVhZG9ubHkgaG9zdDogSUhhbmRsZXJIb3N0KSB7XG5cbiAgICB0aGlzLmxvY2FsVGFnTmFtZSA9IGBjZGthc3NldC0ke3RoaXMuYXNzZXQuaWQuYXNzZXRJZC50b0xvd2VyQ2FzZSgpfWA7XG4gIH1cblxuICBwdWJsaWMgYXN5bmMgcHVibGlzaCgpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBjb25zdCBkZXN0aW5hdGlvbiA9IGF3YWl0IHJlcGxhY2VBd3NQbGFjZWhvbGRlcnModGhpcy5hc3NldC5kZXN0aW5hdGlvbiwgdGhpcy5ob3N0LmF3cyk7XG5cbiAgICBjb25zdCBlY3IgPSBhd2FpdCB0aGlzLmhvc3QuYXdzLmVjckNsaWVudChkZXN0aW5hdGlvbik7XG5cbiAgICBjb25zdCBhY2NvdW50ID0gKGF3YWl0IHRoaXMuaG9zdC5hd3MuZGlzY292ZXJDdXJyZW50QWNjb3VudCgpKS5hY2NvdW50SWQ7XG5cbiAgICBjb25zdCByZXBvVXJpID0gYXdhaXQgcmVwb3NpdG9yeVVyaShlY3IsIGRlc3RpbmF0aW9uLnJlcG9zaXRvcnlOYW1lKTtcbiAgICBpZiAoIXJlcG9VcmkpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgTm8gRUNSIHJlcG9zaXRvcnkgbmFtZWQgJyR7ZGVzdGluYXRpb24ucmVwb3NpdG9yeU5hbWV9JyBpbiBhY2NvdW50ICR7YWNjb3VudH0uIElzIHRoaXMgYWNjb3VudCBib290c3RyYXBwZWQ/YCk7XG4gICAgfVxuXG4gICAgY29uc3QgaW1hZ2VVcmkgPSBgJHtyZXBvVXJpfToke2Rlc3RpbmF0aW9uLmltYWdlVGFnfWA7XG5cbiAgICB0aGlzLmhvc3QuZW1pdE1lc3NhZ2UoRXZlbnRUeXBlLkNIRUNLLCBgQ2hlY2sgJHtpbWFnZVVyaX1gKTtcbiAgICBpZiAoYXdhaXQgaW1hZ2VFeGlzdHMoZWNyLCBkZXN0aW5hdGlvbi5yZXBvc2l0b3J5TmFtZSwgZGVzdGluYXRpb24uaW1hZ2VUYWcpKSB7XG4gICAgICB0aGlzLmhvc3QuZW1pdE1lc3NhZ2UoRXZlbnRUeXBlLkZPVU5ELCBgRm91bmQgJHtpbWFnZVVyaX1gKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5ob3N0LmFib3J0ZWQpIHsgcmV0dXJuOyB9XG5cbiAgICAvLyBMb2dpbiBiZWZvcmUgYnVpbGQgc28gdGhhdCB0aGUgRG9ja2VyZmlsZSBjYW4gcmVmZXJlbmNlIGltYWdlcyBpbiB0aGUgRUNSIHJlcG9cbiAgICBhd2FpdCB0aGlzLmRvY2tlci5sb2dpbihlY3IpO1xuICAgIGF3YWl0IHRoaXMuYnVpbGRJbWFnZSgpO1xuXG4gICAgdGhpcy5ob3N0LmVtaXRNZXNzYWdlKEV2ZW50VHlwZS5VUExPQUQsIGBQdXNoICR7aW1hZ2VVcml9YCk7XG4gICAgaWYgKHRoaXMuaG9zdC5hYm9ydGVkKSB7IHJldHVybjsgfVxuICAgIGF3YWl0IHRoaXMuZG9ja2VyLnRhZyh0aGlzLmxvY2FsVGFnTmFtZSwgaW1hZ2VVcmkpO1xuICAgIGF3YWl0IHRoaXMuZG9ja2VyLnB1c2goaW1hZ2VVcmkpO1xuICB9XG5cbiAgcHJpdmF0ZSBhc3luYyBidWlsZEltYWdlKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIGlmIChhd2FpdCB0aGlzLmRvY2tlci5leGlzdHModGhpcy5sb2NhbFRhZ05hbWUpKSB7XG4gICAgICB0aGlzLmhvc3QuZW1pdE1lc3NhZ2UoRXZlbnRUeXBlLkNBQ0hFRCwgYENhY2hlZCAke3RoaXMubG9jYWxUYWdOYW1lfWApO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IHNvdXJjZSA9IHRoaXMuYXNzZXQuc291cmNlO1xuXG4gICAgY29uc3QgZnVsbFBhdGggPSBwYXRoLnJlc29sdmUodGhpcy53b3JrRGlyLCBzb3VyY2UuZGlyZWN0b3J5KTtcbiAgICB0aGlzLmhvc3QuZW1pdE1lc3NhZ2UoRXZlbnRUeXBlLkJVSUxELCBgQnVpbGRpbmcgRG9ja2VyIGltYWdlIGF0ICR7ZnVsbFBhdGh9YCk7XG5cbiAgICBhd2FpdCB0aGlzLmRvY2tlci5idWlsZCh7XG4gICAgICBkaXJlY3Rvcnk6IGZ1bGxQYXRoLFxuICAgICAgdGFnOiB0aGlzLmxvY2FsVGFnTmFtZSxcbiAgICAgIGJ1aWxkQXJnczogc291cmNlLmRvY2tlckJ1aWxkQXJncyxcbiAgICAgIHRhcmdldDogc291cmNlLmRvY2tlckJ1aWxkVGFyZ2V0LFxuICAgICAgZmlsZTogc291cmNlLmRvY2tlckZpbGUsXG4gICAgfSk7XG4gIH1cbn1cblxuYXN5bmMgZnVuY3Rpb24gaW1hZ2VFeGlzdHMoZWNyOiBBV1MuRUNSLCByZXBvc2l0b3J5TmFtZTogc3RyaW5nLCBpbWFnZVRhZzogc3RyaW5nKSB7XG4gIHRyeSB7XG4gICAgYXdhaXQgZWNyLmRlc2NyaWJlSW1hZ2VzKHsgcmVwb3NpdG9yeU5hbWUsIGltYWdlSWRzOiBbeyBpbWFnZVRhZyB9XSB9KS5wcm9taXNlKCk7XG4gICAgcmV0dXJuIHRydWU7XG4gIH0gY2F0Y2ggKGUpIHtcbiAgICBpZiAoZS5jb2RlICE9PSAnSW1hZ2VOb3RGb3VuZEV4Y2VwdGlvbicpIHsgdGhyb3cgZTsgfVxuICAgIHJldHVybiBmYWxzZTtcbiAgfVxufVxuXG4vKipcbiAqIFJldHVybiB0aGUgVVJJIGZvciB0aGUgcmVwb3NpdG9yeSB3aXRoIHRoZSBnaXZlbiBuYW1lXG4gKlxuICogUmV0dXJucyB1bmRlZmluZWQgaWYgdGhlIHJlcG9zaXRvcnkgZG9lcyBub3QgZXhpc3QuXG4gKi9cbmFzeW5jIGZ1bmN0aW9uIHJlcG9zaXRvcnlVcmkoZWNyOiBBV1MuRUNSLCByZXBvc2l0b3J5TmFtZTogc3RyaW5nKTogUHJvbWlzZTxzdHJpbmcgfCB1bmRlZmluZWQ+IHtcbiAgdHJ5IHtcbiAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IGVjci5kZXNjcmliZVJlcG9zaXRvcmllcyh7IHJlcG9zaXRvcnlOYW1lczogW3JlcG9zaXRvcnlOYW1lXSB9KS5wcm9taXNlKCk7XG4gICAgcmV0dXJuIChyZXNwb25zZS5yZXBvc2l0b3JpZXMgfHwgW10pWzBdPy5yZXBvc2l0b3J5VXJpO1xuICB9IGNhdGNoIChlKSB7XG4gICAgaWYgKGUuY29kZSAhPT0gJ1JlcG9zaXRvcnlOb3RGb3VuZEV4Y2VwdGlvbicpIHsgdGhyb3cgZTsgfVxuICAgIHJldHVybiB1bmRlZmluZWQ7XG4gIH1cbn0iXX0=