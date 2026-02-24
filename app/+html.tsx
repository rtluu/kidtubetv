import { ScrollViewStyleReset } from 'expo-router/html';

export default function Root({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no"
        />
        <title>KidTubeTV - Classic 90s &amp; 00s Kids Shows</title>
        <meta
          name="description"
          content="Watch classic 90s and 00s kids shows from Nickelodeon, Cartoon Network, Disney, PBS and more."
        />
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: globalStyles }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

const globalStyles = `
body {
  background-color: #F0F0FF;
  margin: 0;
  padding: 0;
}
`;
