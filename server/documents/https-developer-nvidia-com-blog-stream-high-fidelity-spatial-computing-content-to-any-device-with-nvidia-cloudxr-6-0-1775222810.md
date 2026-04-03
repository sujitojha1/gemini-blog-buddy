Spatial computing is moving from visualization to active collaboration, adding increasingly more GPU demands on XR hardware to render photorealistic, physics-accurate, high-fidelity spatial content in real time. Meanwhile, developers have had to maintain separate codebases for every platform, each with different toolchains, SDKs, and streaming protocols.
At NVIDIA GTC 2026, NVIDIA CloudXR 6.0 introduced a universal OpenXR-based streaming runtime that works across headsets, operating systems, and browsers—including native visionOS integration. This post walks through how the CloudXR 6.0 architecture works and how to start building today.
CloudXR 6.0: Universal OpenXR streaming
The release focuses on expanding the reach of NVIDIA RTX-powered content to any spatial display without the constraints of local hardware or manual device provisioning.
Native spatial streaming for Apple platforms
NVIDIA and Apple have collaborated to build a high-performance bridge for Apple Vision Pro using privacy-protected foveated streaming enabled by visionOS 26.4. With visionOS for CloudXR, developers can stream high-fidelity, high-frame-rate, and low-latency graphically demanding PC simulations and professional 3D applications—like Autodesk VRED, iRacing, and X-Plane—directly to Apple Vision Pro.
The transition from standard high-resolution streaming to dynamic foveated streaming represents an important step forward in how spatial content is delivered. In standard streaming architectures, the system must encode and transmit a full-size frame at 4K resolution to ensure visual clarity across the entire field of view. This approach is resource-heavy and often pushes the limits of network bandwidth and client-side processing.
Dynamic foveated streaming changes the paradigm by optimizing content based on approximately where a user is looking. Instead of a uniform 4K stream, the system transmits at 1K resolution while maintaining the same pixel density at the fovea (the center of the user’s focus). Despite the massive reduction in data, the system maintains a visual quality that is perceptually similar to a full 4K stream because the high-resolution detail is always where the user is looking.
By adopting foveated streaming, developers and enterprises can unlock four critical benefits:
- High-quality wireless freedom: Stream 4K-like spatial experience and 90 FPS reliably over standard 5GHz WiFi networks.
- Scalable multi-user environments: The reduced bandwidth per user enables simultaneous streaming for multiple users on the same network infrastructure— essential for collaborative design.
- Ultra-low latency: Performance is boosted by reduced transmission and faster encoding and decoding, minimizing motion-to-photon lag.
- Hardware efficiency and battery life: For devices like Apple Vision Pro, this directly translates to preserved battery life for longer sessions in the field or the office.
The integration between visionOS and NVIDIA CloudXR is anchored in a privacy and security by design philosophy. Developers can benefit from foveated streaming without accessing sensitive focus region data. This ensures that the user’s gaze remains private while the application gains the necessary performance optimizations.
Xcode offers a foveated streaming app template that enables the creation of a fully functional, multi-platform application within seconds. Developers can get a pre-configured foundation for spatial streaming with only a few clicks.
Visit the developer and documentation pages for more information.
CloudXR.js: Zero-friction web access
CloudXR.js provides a zero-install path for developers, enabling access to robotics, NVIDIA Omniverse, and OpenXR content through a single web link. By using WebRTC and WebXR, it removes the need for native application installs on devices like Meta Quest 3 and PICO 4 Ultra.
- Visit the developer and documentation pages for more information
Getting started with CloudXR 6.0
The CloudXR 6.0 Runtime SDK is distributed as a set of shared libraries and C headers. The recommended integration path is direct SDK integration: linking the CloudXR libraries into your application and managing the service lifecycle programmatically on both Windows and Linux servers. This gives your application full control over when and how streaming runs.
Server prerequisites
- NVIDIA RTX GPU (RTX 6000 Ada Generation or higher recommended)
- Windows 11 (64-bit) or Ubuntu 22.04+ (64-bit)
- An existing OpenXR application
- CloudXR 6.0 Runtime SDK, downloaded from NVIDIA NGC
Network prerequisites
- IPv4 connectivity
- 200 Mbps minimum for local streaming
Integrating the CloudXR Runtime into a streaming application
The CloudXR Runtime SDK ships with two integration surfaces: the OpenXR runtime manifest openxr_cloudxr.json
tells the OpenXR loader to route your application’s XR sessions through CloudXR, and cxrServiceAPI.h
, a C API for managing the full service lifecycle.
For a complete reference implementation, the CloudXR LÖVR sample shows full lifecycle management and OpenXR session establishment with clients. Developers working in Unreal Engine can follow the dedicated guide.
High-level steps of integrating CloudXR Runtime into a streaming application:
Step 1
- Download the CloudXR 6.0 Runtime from the NVIDIA NGC catalog. The package includes the shared libraries, the OpenXR runtime manifest, and the integration headers needed to embed CloudXR into your application.
Step 2
- Point the OpenXR loader to the
openxr_cloudxr.json
manifest file included in the SDK. - This registers CloudXR as the active runtime on your server for Windows and Linux so that the OpenXR application routes its sessions through CloudXR automatically.
- Once registered, no changes to the application’s rendering code are required. See the CloudXR Runtime documentation for platform-specific registration steps.
Step 3
- Link your application against the CloudXR service library and include
cxrServiceAPI.h
. This gives your application programmatic control over the CloudXR service—when it starts, how it is configured, and when it stops—with the service running as a component alongside your OpenXR application.
Step 4
- Use
nv_cxr_service_create()
to instantiate the service object, then configure it using the property-setting functions in cxrServiceAPI.h before calling start. - Properties cover string, boolean, and numeric parameters, including options like bitrate targets. Refer to the CloudXR Runtime documentation for the full list of supported property names and values.
Step 5
- Call
nv_cxr_service_start()
to bring the service online. - Once running, poll the event queue in your application loop to track connection state—the service surfaces events for both your OpenXR application and streaming clients as they connect and disconnect.
- This lets your application respond intelligently to session changes, such as pausing rendering when no client is present or logging lifecycle events for diagnostics.
Step 6
- When shutting down, signal the service to stop, wait for it to fully terminate, then release the service object.
- The CloudXR Runtime API reference covers the full shutdown sequence.
Step 7
- For applications that need to exchange custom data alongside the video stream—telemetry, simulation state, or commands beyond standard OpenXR actions—CloudXR supports the
XR_NV_opaque_data_channel
extension. - This provides a bidirectional byte channel between server and client, identified by a shared UUID.
- See the CloudXR Opaque Data Channel documentation for integration details.
Alternative to integrating: Stream Manager (Windows only)
For Windows deployments where decoupling runtime management from the application process makes more sense, the CloudXR SDK also includes Stream Manager. This standalone Windows service manages CloudXR runtime instances through an RPC interface. This is particularly useful when multiple applications need to share a single streaming service.
Stream Manager is required to work with the Foveated Streaming in visionOS. See the CloudXR documentation for setup and configuration.
Choose a client integration path
With the server-side integration complete, choose which client SDK to integrate based on your target platform.
Apple platforms (visionOS, iOS, and iPadOS)
The CloudXR framework is distributed as a native Swift Package. Add CloudXRKit as a dependency in your Xcode project, initialize a streaming session pointed at your server, and the framework handles hardware-accelerated video decoding, spatial tracking via ARKit, and local scene rendering through RealityKit while streaming RTX-rendered frames.
Dynamic foveated streaming—using Apple’s FoveatedStreaming API—delivers high-resolution content to the area where the user is looking while keeping gaze data protected, reducing bandwidth requirements without sacrificing perceived quality. For developers starting from scratch, CloudXR also provides an Xcode project template that bootstraps an Apple Vision Pro, iPhone, or iPad client with no boilerplate required.
For a full technical walkthrough, see spatial streaming for Apple platforms and the Apple Platforms developer page.
Web browsers and standalone headsets (CloudXR.js)
CloudXR.js is a JavaScript library that enables streaming directly to WebXR-capable devices—Meta Quest 3, Pico 4 Ultra, and desktop browsers—through a single web link. It uses WebRTC for low-latency video delivery and the WebXR Device API for display and input, and is compatible with WebGL, Three.js, and React Three Fiber.
For more details, see the CloudXR.js developer page.
Get started
For developers ready to get started, integrate the CloudXR Runtime SDK into your existing OpenXR application, register the runtime, and choose the client SDK that fits your target audience. The same server-side integration supports every client platform CloudXR offers.
Resources:
- Visit the NVIDIA CloudXR developer page.
- Download the CloudXR 6.0 Runtime SDK from the NVIDIA NGC catalog.
- Review the full CloudXR SDK documentation.
- Explore the CloudXR LÖVR Sample for a complete reference implementation.
- Join the discussion on the NVIDIA Developer Forums.