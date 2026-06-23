// get the ninja-keys element
const ninja = document.querySelector('ninja-keys');

// add the home and posts menu items
ninja.data = [{
    id: "nav-about",
    title: "About",
    section: "Navigation",
    handler: () => {
      window.location.href = "/";
    },
  },{id: "nav-publications",
          title: "Publications",
          description: "Publications by categories in reversed chronological order.",
          section: "Navigation",
          handler: () => {
            window.location.href = "/publications/";
          },
        },{id: "nav-research-projects",
          title: "Research Projects",
          description: "A showcase of our projects.",
          section: "Navigation",
          handler: () => {
            window.location.href = "/projects/";
          },
        },{id: "projects-gaussian-splatting-vs-classical-photogrammetry",
          title: 'Gaussian Splatting vs. Classical Photogrammetry',
          description: "A comparison of Gaussian Splatting and classical photogrammetry for creating virtual backdrops.",
          section: "Projects",handler: () => {
              window.location.href = "/GSvsPhotogrammetry/";
            },},{id: "projects-impact-of-threshold-relative-curvature-gains-on-cognitive-cost-a-pilot-study",
          title: 'Impact of Threshold-Relative Curvature Gains on Cognitive Cost: A Pilot Study',
          description: "We conducted a pilot study comparing a no-redirection baseline against three redirected-walking conditions calibrated relative to participants&#39; detection thresholds, to examine how the noticeability of redirection affects performance on a concurrent memory task.",
          section: "Projects",handler: () => {
              window.location.href = "/RedirectedWalking/";
            },},{id: "projects-auditory-presentation-of-stimuli-for-cognitive-load-dual-tasks-in-redirected-walking",
          title: 'Auditory Presentation of Stimuli for Cognitive Load Dual Tasks in Redirected Walking',
          description: "We presented an analysis of existing research on working memory (WM) tasks in Redirected Walking (RDW) to examine the feasibility of auditory stimulus presentation as an alternative to traditional visual displays prone to issues in richer virtual environments.",
          section: "Projects",handler: () => {
              window.location.href = "/RedirectedWalkingAuditory/";
            },},{id: "projects-evaluations-of-dynamic-gaussian-splats-versus-point-clouds-for-sparse-captures",
          title: 'Evaluations of Dynamic Gaussian Splats versus Point Clouds for Sparse Captures',
          description: "A subjective quality assessment of dynamic Gaussian splats and point clouds for sparse captures.",
          section: "Projects",handler: () => {
              window.location.href = "/SubjectiveQualityAssessment/";
            },},{id: "projects-involving-users-in-research-projects",
          title: 'Involving Users in Research Projects',
          description: "An integral part of our work consists of testing with users. We developed a guide on how the UX team can best support a variety of projects internally and externally.",
          section: "Projects",handler: () => {
              window.location.href = "/UXGuidelines/";
            },},{id: "projects-a-fast-volumetric-capture-and-reconstruction-pipeline-for-dynamic-point-clouds-and-gaussian-splats",
          title: 'A Fast Volumetric Capture and Reconstruction Pipeline for Dynamic Point Clouds and Gaussian...',
          description: "A volumetric video capture and reconstruction system.",
          section: "Projects",handler: () => {
              window.location.href = "/VVCaptureAndReconstruction/";
            },},{
        id: 'social-email',
        title: 'email',
        section: 'Socials',
        handler: () => {
          window.open("mailto:%69%6E%66%6F.%69%72%63@%68%73%6C%75.%63%68", "_blank");
        },
      },{
        id: 'social-linkedin_company',
        title: 'Linkedin_company',
        section: 'Socials',
        handler: () => {
          window.open("", "_blank");
        },
      },{
      id: 'light-theme',
      title: 'Change theme to light',
      description: 'Change the theme of the site to Light',
      section: 'Theme',
      handler: () => {
        setThemeSetting("light");
      },
    },
    {
      id: 'dark-theme',
      title: 'Change theme to dark',
      description: 'Change the theme of the site to Dark',
      section: 'Theme',
      handler: () => {
        setThemeSetting("dark");
      },
    },
    {
      id: 'system-theme',
      title: 'Use system default theme',
      description: 'Change the theme of the site to System Default',
      section: 'Theme',
      handler: () => {
        setThemeSetting("system");
      },
    },];
