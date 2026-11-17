# Github Trending Repos

GitHub's daily trending repositories for 29 languages, all on one page. GitHub's own trending page shows one language at a time, so if you follow several you end up opening a tab for each and seeing the same repos again and again. Here you open one page and see what is popular across all of them.

**Live:** https://sh0sh0.netlify.app/ghtr

![Github Trending Repos](https://github.com/user-attachments/assets/b5a0c73d-db4c-4e9b-900e-666150bc49e4)

## Features

1. **One table** with the language, the repository, its stars, the stars it gained today and its forks. Click a repo to open it on GitHub.
2. **No repeats:** a repo trending in several languages is shown once.
3. **Sort** by stars, stars today or forks. It starts with what is growing fastest today.
4. **29 languages,** from Python, JavaScript, TypeScript, Rust and Go to Dart, Kotlin, Swift and Zig, plus GitHub's overall list.
5. **Fast:** the list is fetched once a day and kept in memory, so the page loads quickly.
6. **Free, no sign-up,** and it works on a phone, a tablet and a computer.

## Run it yourself

You need Node.js and Yarn.

```bash
git clone https://github.com/p32929/github-trending-repos.git
cd github-trending-repos
yarn install
yarn dev
```

For production:

```bash
yarn build
yarn start
```

## API

`GET /api/trending` fetches today's trending list (or uses today's saved copy). Add `?forceRefresh=true` to fetch it again. The page gets the results live over Socket.IO.

## Good to know

GitHub has no trending API, so the server reads GitHub's trending pages. If GitHub changes how those pages are built, it will need a small fix.

## Contributing

Contributions are very welcome, thank you! Before you start on a pull request, please open an issue and tell me what you would like to add or change. That way we can agree on it first, and your time is not wasted on something that might not fit. Thanks for helping make Github Trending Repos better.

<p><a href="https://p32929.github.io/share/?repo=github-trending-repos"><picture><source media="(prefers-color-scheme: dark)" srcset="https://p32929.github.io/readme/footer-share-dark.svg"><img src="https://p32929.github.io/readme/footer-share-light.svg" width="50%" align="top" alt="Share this project with your friends in one click"></picture></a><a href="https://p32929.github.io/support/"><picture><source media="(prefers-color-scheme: dark)" srcset="https://p32929.github.io/readme/footer-support-dark.svg"><img src="https://p32929.github.io/readme/footer-support-light.svg" width="50%" align="top" alt="If you like my work and want to support me, feel free to support"></picture></a><br><a href="https://openstore.pfay.workers.dev/add"><picture><source media="(prefers-color-scheme: dark)" srcset="https://p32929.github.io/readme/footer-join-dark.svg"><img src="https://p32929.github.io/readme/footer-join-light.svg" width="100%" align="top" alt="Put your own apps on OpenStore: free, your listing lives in your own repo"></picture></a></p>
