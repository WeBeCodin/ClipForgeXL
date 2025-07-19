# Editframe JS SDK

The Editframe JS SDK is a Node.js library that allows developers to easily integrate Editframe into their web applications. Our goal is to make it extremely easy for software developers to incorporate video composition and editing experiences into their applications.

[![npm version](https://badge.fury.io/js/%40editframe%2Feditframe-js.svg)](https://badge.fury.io/js/%40editframe%2Feditframe-js)

Note: **This library currently only works in `Node` environments and does not work in a browser. Additionally, this should
only be used in server environments to protect your API key.**

## Installation
You can install the Editframe JS SDK using npm or yarn:

Npm
```sh
npm install @editframe/editframe-js
```
Yarn
```sh
yarn add @editframe/editframe-js
```


## Getting Started

To get started with the Editframe JS SDK, you will need to obtain an API key from the Editframe dashboard.

Once you have your API key, you can create an instance of the Editframe class:


```
import { Editframe } from "@editframe/editframe-js"

const editframe = new Editframe({ token: "API_TOKEN" })

const composition = await editframe.videos.new(
  {
    backgroundColor: "#c400ac",
    dimensions: {
      height: 1080,
      width: 1920,
    },
    duration: 10,
    metadata: {
      user_id: 1
    },
  },
  "https://editframe.com/docs/composition/create-composition/puppy-beach.mp4"
);

await composition.encode();

```

### API Reference
For a complete reference of the Editframe JS SDK API, please see the [API documentation](https://editframe.com/docs).


