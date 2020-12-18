"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ToolkitResourcesInfo = exports.ToolkitStackInfo = exports.DEFAULT_TOOLKIT_STACK_NAME = void 0;
const colors = require("colors/safe");
const logging_1 = require("../logging");
const bootstrap_1 = require("./bootstrap");
const cloudformation_1 = require("./util/cloudformation");
exports.DEFAULT_TOOLKIT_STACK_NAME = 'CDKToolkit';
class ToolkitStackInfo {
    constructor(stack) {
        this.stack = stack;
    }
    static determineName(overrideName) {
        return overrideName !== null && overrideName !== void 0 ? overrideName : exports.DEFAULT_TOOLKIT_STACK_NAME;
    }
    static async lookup(environment, sdk, stackName) {
        const cfn = sdk.cloudFormation();
        const stack = await cloudformation_1.stabilizeStack(cfn, stackName !== null && stackName !== void 0 ? stackName : exports.DEFAULT_TOOLKIT_STACK_NAME);
        if (!stack) {
            logging_1.debug('The environment %s doesn\'t have the CDK toolkit stack (%s) installed. Use %s to setup your environment for use with the toolkit.', environment.name, stackName, colors.blue(`cdk bootstrap "${environment.name}"`));
            return undefined;
        }
        if (stack.stackStatus.isCreationFailure) {
            // Treat a "failed to create" bootstrap stack as an absent one.
            logging_1.debug('The environment %s has a CDK toolkit stack (%s) that failed to create. Use %s to try provisioning it again.', environment.name, stackName, colors.blue(`cdk bootstrap "${environment.name}"`));
            return undefined;
        }
        return new ToolkitStackInfo(stack);
    }
    get version() {
        var _a;
        return parseInt((_a = this.stack.outputs[bootstrap_1.BOOTSTRAP_VERSION_OUTPUT]) !== null && _a !== void 0 ? _a : '0', 10);
    }
    get parameters() {
        var _a;
        return (_a = this.stack.parameters) !== null && _a !== void 0 ? _a : {};
    }
}
exports.ToolkitStackInfo = ToolkitStackInfo;
async function getSsmParameterValue(sdk, parameterName) {
    const ssm = sdk.ssm();
    try {
        return await ssm.getParameter({ Name: parameterName }).promise();
    }
    catch (e) {
        if (e.code === 'ParameterNotFound') {
            return {};
        }
        throw e;
    }
}
/**
 * Information on the Bootstrap stack
 *
 * Called "ToolkitInfo" for historical reasons.
 *
 * @experimental
 */
class ToolkitResourcesInfo {
    constructor(sdk, { bucketName, bucketDomainName, version }) {
        this.sdk = sdk;
        this.bucketName = bucketName;
        this.bucketUrl = `https://${bucketDomainName}`;
        this.version = version;
    }
    /** @experimental */
    static async lookup(environment, sdk, qualifier) {
        var _a, _b, _c, _d;
        const qualifierValue = qualifier !== null && qualifier !== void 0 ? qualifier : 'hnb659fds';
        const bucketName = (_a = (await getSsmParameterValue(sdk, `/cdk-bootstrap/${qualifierValue}/bucket-name`)).Parameter) === null || _a === void 0 ? void 0 : _a.Value;
        const bucketDomainName = (_b = (await getSsmParameterValue(sdk, `/cdk-bootstrap/${qualifierValue}/bucket-domain-name`)).Parameter) === null || _b === void 0 ? void 0 : _b.Value;
        const version = parseInt((_d = (_c = (await getSsmParameterValue(sdk, `/cdk-bootstrap/${qualifierValue}/version`)).Parameter) === null || _c === void 0 ? void 0 : _c.Value) !== null && _d !== void 0 ? _d : '0', 10);
        if (bucketName === undefined || bucketDomainName === undefined || version == 0) {
            logging_1.debug('The environment %s doesn\'t have the CDK toolkit stack installed. Use %s to setup your environment for use with the toolkit.', environment.name, colors.blue(`cdk bootstrap "${environment.name}"`));
            return undefined;
        }
        return new ToolkitResourcesInfo(sdk, { bucketName, bucketDomainName, version });
    }
    /**
     * Prepare an ECR repository for uploading to using Docker
     *
     * @experimental
     */
    async prepareEcrRepository(repositoryName) {
        var _a, _b;
        if (!this.sdk) {
            throw new Error('ToolkitInfo needs to have been initialized with an sdk to call prepareEcrRepository');
        }
        const ecr = this.sdk.ecr();
        // check if repo already exists
        try {
            logging_1.debug(`${repositoryName}: checking if ECR repository already exists`);
            const describeResponse = await ecr.describeRepositories({ repositoryNames: [repositoryName] }).promise();
            const existingRepositoryUri = (_a = describeResponse.repositories[0]) === null || _a === void 0 ? void 0 : _a.repositoryUri;
            if (existingRepositoryUri) {
                return { repositoryUri: existingRepositoryUri };
            }
        }
        catch (e) {
            if (e.code !== 'RepositoryNotFoundException') {
                throw e;
            }
        }
        // create the repo (tag it so it will be easier to garbage collect in the future)
        logging_1.debug(`${repositoryName}: creating ECR repository`);
        const assetTag = { Key: 'awscdk:asset', Value: 'true' };
        const response = await ecr.createRepository({ repositoryName, tags: [assetTag] }).promise();
        const repositoryUri = (_b = response.repository) === null || _b === void 0 ? void 0 : _b.repositoryUri;
        if (!repositoryUri) {
            throw new Error(`CreateRepository did not return a repository URI for ${repositoryUri}`);
        }
        // configure image scanning on push (helps in identifying software vulnerabilities, no additional charge)
        logging_1.debug(`${repositoryName}: enable image scanning`);
        await ecr.putImageScanningConfiguration({ repositoryName, imageScanningConfiguration: { scanOnPush: true } }).promise();
        return { repositoryUri };
    }
}
exports.ToolkitResourcesInfo = ToolkitResourcesInfo;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidG9vbGtpdC1pbmZvLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsidG9vbGtpdC1pbmZvLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUNBLHNDQUFzQztBQUN0Qyx3Q0FBbUM7QUFFbkMsMkNBQXVEO0FBQ3ZELDBEQUE0RTtBQUUvRCxRQUFBLDBCQUEwQixHQUFHLFlBQVksQ0FBQztBQUV2RCxNQUFhLGdCQUFnQjtJQXVCM0IsWUFBNEIsS0FBMEI7UUFBMUIsVUFBSyxHQUFMLEtBQUssQ0FBcUI7SUFDdEQsQ0FBQztJQXZCTSxNQUFNLENBQUMsYUFBYSxDQUFDLFlBQXFCO1FBQy9DLE9BQU8sWUFBWSxhQUFaLFlBQVksY0FBWixZQUFZLEdBQUksa0NBQTBCLENBQUM7SUFDcEQsQ0FBQztJQUVNLE1BQU0sQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLFdBQThCLEVBQUUsR0FBUyxFQUFFLFNBQTZCO1FBQ2pHLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQyxjQUFjLEVBQUUsQ0FBQztRQUNqQyxNQUFNLEtBQUssR0FBRyxNQUFNLCtCQUFjLENBQUMsR0FBRyxFQUFFLFNBQVMsYUFBVCxTQUFTLGNBQVQsU0FBUyxHQUFJLGtDQUEwQixDQUFDLENBQUM7UUFDakYsSUFBSSxDQUFDLEtBQUssRUFBRTtZQUNWLGVBQUssQ0FBQyxtSUFBbUksRUFDdkksV0FBVyxDQUFDLElBQUksRUFBRSxTQUFTLEVBQUUsTUFBTSxDQUFDLElBQUksQ0FBQyxrQkFBa0IsV0FBVyxDQUFDLElBQUksR0FBRyxDQUFDLENBQUMsQ0FBQztZQUNuRixPQUFPLFNBQVMsQ0FBQztTQUNsQjtRQUNELElBQUksS0FBSyxDQUFDLFdBQVcsQ0FBQyxpQkFBaUIsRUFBRTtZQUN2QywrREFBK0Q7WUFDL0QsZUFBSyxDQUFDLDZHQUE2RyxFQUNqSCxXQUFXLENBQUMsSUFBSSxFQUFFLFNBQVMsRUFBRSxNQUFNLENBQUMsSUFBSSxDQUFDLGtCQUFrQixXQUFXLENBQUMsSUFBSSxHQUFH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QWMseUJBQXlCLENBQUMsQ0FBQztRQUNsRCxNQUFNLEdBQUcsQ0FBQyw2QkFBNkIsQ0FBQyxFQUFFLGNBQWMsRUFBRSwwQkFBMEIsRUFBRSxFQUFFLFVBQVUsRUFBRSxJQUFJLEVBQUUsRUFBRSxDQUFDLENBQUMsT0FBTyxFQUFFLENBQUM7UUFFeEgsT0FBTyxFQUFFLGFBQWEsRUFBRSxDQUFDO0lBQzNCLENBQUM7Q0FDRjtBQWpFRCxvREFpRUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBjeGFwaSBmcm9tICdAYXdzLWNkay9jeC1hcGknO1xuaW1wb3J0ICogYXMgY29sb3JzIGZyb20gJ2NvbG9ycy9zYWZlJztcbmltcG9ydCB7IGRlYnVnIH0gZnJvbSAnLi4vbG9nZ2luZyc7XG5pbXBvcnQgeyBJU0RLIH0gZnJvbSAnLi9hd3MtYXV0aCc7XG5pbXBvcnQgeyBCT09UU1RSQVBfVkVSU0lPTl9PVVRQVVQgfSBmcm9tICcuL2Jvb3RzdHJhcCc7XG5pbXBvcnQgeyBzdGFiaWxpemVTdGFjaywgQ2xvdWRGb3JtYXRpb25TdGFjayB9IGZyb20gJy4vdXRpbC9jbG91ZGZvcm1hdGlvbic7XG5cbmV4cG9ydCBjb25zdCBERUZBVUxUX1RPT0xLSVRfU1RBQ0tfTkFNRSA9ICdDREtUb29sa2l0JztcblxuZXhwb3J0IGNsYXNzIFRvb2xraXRTdGFja0luZm8ge1xuICBwdWJsaWMgc3RhdGljIGRldGVybWluZU5hbWUob3ZlcnJpZGVOYW1lPzogc3RyaW5nKSB7XG4gICAgcmV0dXJuIG92ZXJyaWRlTmFtZSA/PyBERUZBVUxUX1RPT0xLSVRfU1RBQ0tfTkFNRTtcbiAgfVxuXG4gIHB1YmxpYyBzdGF0aWMgYXN5bmMgbG9va3VwKGVudmlyb25tZW50OiBjeGFwaS5FbnZpcm9ubWVudCwgc2RrOiBJU0RLLCBzdGFja05hbWU6IHN0cmluZyB8IHVuZGVmaW5lZCk6IFByb21pc2U8VG9vbGtpdFN0YWNrSW5mbyB8IHVuZGVmaW5lZD4ge1xuICAgIGNvbnN0IGNmbiA9IHNkay5jbG91ZEZvcm1hdGlvbigpO1xuICAgIGNvbnN0IHN0YWNrID0gYXdhaXQgc3RhYmlsaXplU3RhY2soY2ZuLCBzdGFja05hbWUgPz8gREVGQVVMVF9UT09MS0lUX1NUQUNLX05BTUUpO1xuICAgIGlmICghc3RhY2spIHtcbiAgICAgIGRlYnVnKCdUaGUgZW52aXJvbm1lbnQgJXMgZG9lc25cXCd0IGhhdmUgdGhlIENESyB0b29sa2l0IHN0YWNrICglcykgaW5zdGFsbGVkLiBVc2UgJXMgdG8gc2V0dXAgeW91ciBlbnZpcm9ubWVudCBmb3IgdXNlIHdpdGggdGhlIHRvb2xraXQuJyxcbiAgICAgICAgZW52aXJvbm1lbnQubmFtZSwgc3RhY2tOYW1lLCBjb2xvcnMuYmx1ZShgY2RrIGJvb3RzdHJhcCBcIiR7ZW52aXJvbm1lbnQubmFtZX1cImApKTtcbiAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgfVxuICAgIGlmIChzdGFjay5zdGFja1N0YXR1cy5pc0NyZWF0aW9uRmFpbHVyZSkge1xuICAgICAgLy8gVHJlYXQgYSBcImZhaWxlZCB0byBjcmVhdGVcIiBib290c3RyYXAgc3RhY2sgYXMgYW4gYWJzZW50IG9uZS5cbiAgICAgIGRlYnVnKCdUaGUgZW52aXJvbm1lbnQgJXMgaGFzIGEgQ0RLIHRvb2xraXQgc3RhY2sgKCVzKSB0aGF0IGZhaWxlZCB0byBjcmVhdGUuIFVzZSAlcyB0byB0cnkgcHJvdmlzaW9uaW5nIGl0IGFnYWluLicsXG4gICAgICAgIGVudmlyb25tZW50Lm5hbWUsIHN0YWNrTmFtZSwgY29sb3JzLmJsdWUoYGNkayBib290c3RyYXAgXCIke2Vudmlyb25tZW50Lm5hbWV9XCJgKSk7XG4gICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgIH1cblxuICAgIHJldHVybiBuZXcgVG9vbGtpdFN0YWNrSW5mbyhzdGFjayk7XG4gIH1cblxuICBjb25zdHJ1Y3RvcihwdWJsaWMgcmVhZG9ubHkgc3RhY2s6IENsb3VkRm9ybWF0aW9uU3RhY2spIHtcbiAgfVxuXG4gIHB1YmxpYyBnZXQgdmVyc2lvbigpIHtcbiAgICByZXR1cm4gcGFyc2VJbnQodGhpcy5zdGFjay5vdXRwdXRzW0JPT1RTVFJBUF9WRVJTSU9OX09VVFBVVF0gPz8gJzAnLCAxMCk7XG4gIH1cblxuICBwdWJsaWMgZ2V0IHBhcmFtZXRlcnMoKTogUmVjb3JkPHN0cmluZywgc3RyaW5nPiB7XG4gICAgcmV0dXJuIHRoaXMuc3RhY2sucGFyYW1ldGVycyA/PyB7fTtcbiAgfVxuXG59XG5cbmludGVyZmFjZSBUb29sa2l0UmVzb3JjZXNJbmZvUHJvcHMge1xuICBidWNrZXROYW1lOiBzdHJpbmc7XG4gIGJ1Y2tldERvbWFpbk5hbWU6IHN0cmluZztcbiAgdmVyc2lvbjogbnVtYmVyO1xufVxuXG5cbmFzeW5jIGZ1bmN0aW9uIGdldFNzbVBhcmFtZXRlclZhbHVlKHNkazogSVNESywgcGFyYW1ldGVyTmFtZTogc3RyaW5nKTogUHJvbWlzZTxBV1MuU1NNLkdldFBhcmFtZXRlclJlc3VsdD4ge1xuICBjb25zdCBzc20gPSBzZGsuc3NtKCk7XG4gIHRyeSB7XG4gICAgcmV0dXJuIGF3YWl0IHNzbS5nZXRQYXJhbWV0ZXIoeyBOYW1lOiBwYXJhbWV0ZXJOYW1lIH0pLnByb21pc2UoKTtcbiAgfSBjYXRjaCAoZSkge1xuICAgIGlmIChlLmNvZGUgPT09ICdQYXJhbWV0ZXJOb3RGb3VuZCcpIHtcbiAgICAgIHJldHVybiB7fTtcbiAgICB9XG4gICAgdGhyb3cgZTtcbiAgfVxufVxuXG4vKipcbiAqIEluZm9ybWF0aW9uIG9uIHRoZSBCb290c3RyYXAgc3RhY2tcbiAqXG4gKiBDYWxsZWQgXCJUb29sa2l0SW5mb1wiIGZvciBoaXN0b3JpY2FsIHJlYXNvbnMuXG4gKlxuICogQGV4cGVyaW1lbnRhbFxuICovXG5leHBvcnQgY2xhc3MgVG9vbGtpdFJlc291cmNlc0luZm8ge1xuICAvKiogQGV4cGVyaW1lbnRhbCAqL1xuICBwdWJsaWMgc3RhdGljIGFzeW5jIGxvb2t1cChlbnZpcm9ubWVudDogY3hhcGkuRW52aXJvbm1lbnQsIHNkazogSVNESywgcXVhbGlmaWVyPzogc3RyaW5nKTogUHJvbWlzZTxUb29sa2l0UmVzb3VyY2VzSW5mbyB8IHVuZGVmaW5lZD4ge1xuICAgIGNvbnN0IHF1YWxpZmllclZhbHVlID0gcXVhbGlmaWVyID8/ICdobmI2NTlmZHMnO1xuICAgIGNvbnN0IGJ1Y2tldE5hbWUgPSAoYXdhaXQgZ2V0U3NtUGFyYW1ldGVyVmFsdWUoc2RrLCBgL2Nkay1ib290c3RyYXAvJHtxdWFsaWZpZXJWYWx1ZX0vYnVja2V0LW5hbWVgKSkuUGFyYW1ldGVyPy5WYWx1ZTtcbiAgICBjb25zdCBidWNrZXREb21haW5OYW1lID0gKGF3YWl0IGdldFNzbVBhcmFtZXRlclZhbHVlKHNkaywgYC9jZGstYm9vdHN0cmFwLyR7cXVhbGlmaWVyVmFsdWV9L2J1Y2tldC1kb21haW4tbmFtZWApKS5QYXJhbWV0ZXI/LlZhbHVlO1xuICAgIGNvbnN0IHZlcnNpb24gPSBwYXJzZUludCgoYXdhaXQgZ2V0U3NtUGFyYW1ldGVyVmFsdWUoc2RrLCBgL2Nkay1ib290c3RyYXAvJHtxdWFsaWZpZXJWYWx1ZX0vdmVyc2lvbmApKS5QYXJhbWV0ZXI/LlZhbHVlID8/ICcwJywgMTApO1xuXG4gICAgaWYgKGJ1Y2tldE5hbWUgPT09IHVuZGVmaW5lZCB8fCBidWNrZXREb21haW5OYW1lID09PSB1bmRlZmluZWQgfHwgdmVyc2lvbiA9PSAwKSB7XG4gICAgICBkZWJ1ZygnVGhlIGVudmlyb25tZW50ICVzIGRvZXNuXFwndCBoYXZlIHRoZSBDREsgdG9vbGtpdCBzdGFjayBpbnN0YWxsZWQuIFVzZSAlcyB0byBzZXR1cCB5b3VyIGVudmlyb25tZW50IGZvciB1c2Ugd2l0aCB0aGUgdG9vbGtpdC4nLFxuICAgICAgICBlbnZpcm9ubWVudC5uYW1lLCBjb2xvcnMuYmx1ZShgY2RrIGJvb3RzdHJhcCBcIiR7ZW52aXJvbm1lbnQubmFtZX1cImApKTtcbiAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgfVxuXG4gICAgcmV0dXJuIG5ldyBUb29sa2l0UmVzb3VyY2VzSW5mbyhzZGssIHsgYnVja2V0TmFtZSwgYnVja2V0RG9tYWluTmFtZSwgdmVyc2lvbiB9KTtcbiAgfVxuXG4gIHB1YmxpYyByZWFkb25seSBidWNrZXROYW1lOiBzdHJpbmc7XG4gIHB1YmxpYyByZWFkb25seSBidWNrZXRVcmw6IHN0cmluZztcbiAgcHVibGljIHJlYWRvbmx5IHZlcnNpb246IG51bWJlcjtcblxuICBjb25zdHJ1Y3Rvcihwcml2YXRlIHJlYWRvbmx5IHNkazogSVNESywgeyBidWNrZXROYW1lLCBidWNrZXREb21haW5OYW1lLCB2ZXJzaW9uIH06IFRvb2xraXRSZXNvcmNlc0luZm9Qcm9wcykge1xuICAgIHRoaXMuYnVja2V0TmFtZSA9IGJ1Y2tldE5hbWU7XG4gICAgdGhpcy5idWNrZXRVcmwgPSBgaHR0cHM6Ly8ke2J1Y2tldERvbWFpbk5hbWV9YDtcbiAgICB0aGlzLnZlcnNpb24gPSB2ZXJzaW9uO1xuICB9XG5cbiAgLyoqXG4gICAqIFByZXBhcmUgYW4gRUNSIHJlcG9zaXRvcnkgZm9yIHVwbG9hZGluZyB0byB1c2luZyBEb2NrZXJcbiAgICpcbiAgICogQGV4cGVyaW1lbnRhbFxuICAgKi9cbiAgcHVibGljIGFzeW5jIHByZXBhcmVFY3JSZXBvc2l0b3J5KHJlcG9zaXRvcnlOYW1lOiBzdHJpbmcpOiBQcm9taXNlPEVjclJlcG9zaXRvcnlJbmZvPiB7XG4gICAgaWYgKCF0aGlzLnNkaykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdUb29sa2l0SW5mbyBuZWVkcyB0byBoYXZlIGJlZW4gaW5pdGlhbGl6ZWQgd2l0aCBhbiBzZGsgdG8gY2FsbCBwcmVwYXJlRWNyUmVwb3NpdG9yeScpO1xuICAgIH1cbiAgICBjb25zdCBlY3IgPSB0aGlzLnNkay5lY3IoKTtcblxuICAgIC8vIGNoZWNrIGlmIHJlcG8gYWxyZWFkeSBleGlzdHNcbiAgICB0cnkge1xuICAgICAgZGVidWcoYCR7cmVwb3NpdG9yeU5hbWV9OiBjaGVja2luZyBpZiBFQ1IgcmVwb3NpdG9yeSBhbHJlYWR5IGV4aXN0c2ApO1xuICAgICAgY29uc3QgZGVzY3JpYmVSZXNwb25zZSA9IGF3YWl0IGVjci5kZXNjcmliZVJlcG9zaXRvcmllcyh7IHJlcG9zaXRvcnlOYW1lczogW3JlcG9zaXRvcnlOYW1lXSB9KS5wcm9taXNlKCk7XG4gICAgICBjb25zdCBleGlzdGluZ1JlcG9zaXRvcnlVcmkgPSBkZXNjcmliZVJlc3BvbnNlLnJlcG9zaXRvcmllcyFbMF0/LnJlcG9zaXRvcnlVcmk7XG4gICAgICBpZiAoZXhpc3RpbmdSZXBvc2l0b3J5VXJpKSB7XG4gICAgICAgIHJldHVybiB7IHJlcG9zaXRvcnlVcmk6IGV4aXN0aW5nUmVwb3NpdG9yeVVyaSB9O1xuICAgICAgfVxuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIGlmIChlLmNvZGUgIT09ICdSZXBvc2l0b3J5Tm90Rm91bmRFeGNlcHRpb24nKSB7IHRocm93IGU7IH1cbiAgICB9XG5cbiAgICAvLyBjcmVhdGUgdGhlIHJlcG8gKHRhZyBpdCBzbyBpdCB3aWxsIGJlIGVhc2llciB0byBnYXJiYWdlIGNvbGxlY3QgaW4gdGhlIGZ1dHVyZSlcbiAgICBkZWJ1ZyhgJHtyZXBvc2l0b3J5TmFtZX06IGNyZWF0aW5nIEVDUiByZXBvc2l0b3J5YCk7XG4gICAgY29uc3QgYXNzZXRUYWcgPSB7IEtleTogJ2F3c2Nkazphc3NldCcsIFZhbHVlOiAndHJ1ZScgfTtcbiAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IGVjci5jcmVhdGVSZXBvc2l0b3J5KHsgcmVwb3NpdG9yeU5hbWUsIHRhZ3M6IFthc3NldFRhZ10gfSkucHJvbWlzZSgpO1xuICAgIGNvbnN0IHJlcG9zaXRvcnlVcmkgPSByZXNwb25zZS5yZXBvc2l0b3J5Py5yZXBvc2l0b3J5VXJpO1xuICAgIGlmICghcmVwb3NpdG9yeVVyaSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBDcmVhdGVSZXBvc2l0b3J5IGRpZCBub3QgcmV0dXJuIGEgcmVwb3NpdG9yeSBVUkkgZm9yICR7cmVwb3NpdG9yeVVyaX1gKTtcbiAgICB9XG5cbiAgICAvLyBjb25maWd1cmUgaW1hZ2Ugc2Nhbm5pbmcgb24gcHVzaCAoaGVscHMgaW4gaWRlbnRpZnlpbmcgc29mdHdhcmUgdnVsbmVyYWJpbGl0aWVzLCBubyBhZGRpdGlvbmFsIGNoYXJnZSlcbiAgICBkZWJ1ZyhgJHtyZXBvc2l0b3J5TmFtZX06IGVuYWJsZSBpbWFnZSBzY2FubmluZ2ApO1xuICAgIGF3YWl0IGVjci5wdXRJbWFnZVNjYW5uaW5nQ29uZmlndXJhdGlvbih7IHJlcG9zaXRvcnlOYW1lLCBpbWFnZVNjYW5uaW5nQ29uZmlndXJhdGlvbjogeyBzY2FuT25QdXNoOiB0cnVlIH0gfSkucHJvbWlzZSgpO1xuXG4gICAgcmV0dXJuIHsgcmVwb3NpdG9yeVVyaSB9O1xuICB9XG59XG5cbi8qKiBAZXhwZXJpbWVudGFsICovXG5leHBvcnQgaW50ZXJmYWNlIEVjclJlcG9zaXRvcnlJbmZvIHtcbiAgcmVwb3NpdG9yeVVyaTogc3RyaW5nO1xufVxuXG4vKiogQGV4cGVyaW1lbnRhbCAqL1xuZXhwb3J0IGludGVyZmFjZSBFY3JDcmVkZW50aWFscyB7XG4gIHVzZXJuYW1lOiBzdHJpbmc7XG4gIHBhc3N3b3JkOiBzdHJpbmc7XG4gIGVuZHBvaW50OiBzdHJpbmc7XG59XG4iXX0=