---
layout: publication
title: A Fast Volumetric Capture and Reconstruction Pipeline for Dynamic Point Clouds and Gaussian Splats
description: A volumetric video capture and reconstruction system.
img: assets/img/cvmp2025_teaser.png
importance: 1
category: volumetric video
related_publications: false
permalink: /VVCaptureAndReconstruction/
bibtex_key: charisoudis2025vv
teaser_image: assets/img/cvmp2025_teaser.png
---
## Abstract

We present a fast and efficient volumetric capture and reconstruction system that processes either RGB-D or RGB-only input to generate 3D representations in the form of point clouds and Gaussian splats. For Gaussian splat reconstructions, we took the GPS-Gaussian regressor and improved it, enabling high-quality reconstructions with minimal overhead. The system is designed for easy setup and deployment, supporting in-the-wild operation under uncontrolled illumination and arbitrary backgrounds, as well as flexible camera configurations, including sparse setups,  arbitrary camera numbers and baselines. Captured data can be exported in standard formats such as PLY, MPEG V-PCC, and SPLAT, and visualized through a web-based viewer or Unity/Unreal plugins. A live on-location preview of both input and reconstruction is available at 5–10 FPS. We present qualitative findings focused on deployability and targeted ablations. The complete framework is open-source, facilitating reproducibility and further research.

## Pipeline

<img src="../assets/img/cvmp2025_pipeline.png" alt="pipeline" style="max-width:100%; height:auto;">

## Results

### Images

<img src="../assets/img/cvmp2025_reconstructions.png" alt="reconstructions" style="max-width:100%; height:auto;">

### Videos

*Coming soon...*

## Code

*Coming soon...*

## Citation

If you find this code useful for your research, please consider citing:

```bibtex
@inproceedings{charisoudis2025vv,
  title={A Fast Volumetric Capture and Reconstruction Pipeline for Dynamic Point Clouds and Gaussian Splats},
  author={Charisoudis, Athanasios and Croci, Simone and Lam, Kit Yung and Frossard, Pascal and Smolic, Aljosa},
  booktitle={Proceedings of the 22nd ACM SIGGRAPH European Conference on Visual Media Production (CVMP)},
  year={2025}
}
```
