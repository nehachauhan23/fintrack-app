// /** @type {import('next').NextConfig} */
// const nextConfig = {
//   images: {
//     remotePatterns: [
//       {
//         protocol: "https",
//         hostname: ["randomuser.me",
//         'logoipsum.com',
//       'img.icons8.com',
//       'randomuser.me',]
//       },
//     ],
//   },

//   experimental: {
//     serverActions: {
//       bodySizeLimit: "5mb",
//     },
//   },
// };

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['logoipsum.com',
      'img.icons8.com',
      'randomuser.me',
    ],
  },
};

export default nextConfig;
