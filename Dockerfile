# *****************************
# *** STAGE 1: Dependencies ***
# *****************************
FROM node:22.11.0-alpine AS deps
RUN apk add --no-cache libc6-compat python3 make g++ git
RUN ln -sf /usr/bin/python3 /usr/bin/python

WORKDIR /app
COPY package.json yarn.lock tsconfig.json ./
COPY types ./types
COPY lib ./lib
COPY configs/app ./configs/app
COPY toolkit/theme ./toolkit/theme
COPY toolkit/utils ./toolkit/utils
COPY toolkit/components/forms/validators/url.ts ./toolkit/components/forms/validators/url.ts
RUN yarn --frozen-lockfile --network-timeout 100000

# Feature reporter
WORKDIR /feature-reporter
COPY ./deploy/tools/feature-reporter/package.json ./deploy/tools/feature-reporter/yarn.lock ./
RUN yarn --frozen-lockfile --network-timeout 100000

# Env validator
WORKDIR /envs-validator
COPY ./deploy/tools/envs-validator/package.json ./deploy/tools/envs-validator/yarn.lock ./
RUN yarn --frozen-lockfile --network-timeout 100000

# Favicon generator
WORKDIR /favicon-generator
COPY ./deploy/tools/favicon-generator/package.json ./deploy/tools/favicon-generator/yarn.lock ./
RUN yarn --frozen-lockfile --network-timeout 100000

# Sitemap generator
WORKDIR /sitemap-generator
COPY ./deploy/tools/sitemap-generator/package.json ./deploy/tools/sitemap-generator/yarn.lock ./
RUN yarn --frozen-lockfile --network-timeout 100000

# Multichain config generator
WORKDIR /multichain-config-generator
COPY ./deploy/tools/multichain-config-generator/package.json ./deploy/tools/multichain-config-generator/yarn.lock ./
RUN yarn --frozen-lockfile --network-timeout 100000

# *****************************
# ****** STAGE 2: Build *******
# *****************************
FROM node:22.11.0-alpine AS builder
RUN apk add --no-cache --upgrade libc6-compat bash jq

ARG GIT_COMMIT_SHA
ENV NEXT_PUBLIC_GIT_COMMIT_SHA=$GIT_COMMIT_SHA
ARG GIT_TAG
ENV NEXT_PUBLIC_GIT_TAG=$GIT_TAG
ARG NEXT_OPEN_TELEMETRY_ENABLED
ENV NEXT_OPEN_TELEMETRY_ENABLED=$NEXT_OPEN_TELEMETRY_ENABLED

ENV NODE_ENV production
WORKDIR /app

# Copy dependencies and source code
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build SVG sprite and collect ENVs
RUN set -a && \
    ./deploy/scripts/build_sprite.sh && \
    ./deploy/scripts/collect_envs.sh ./docs/ENVS.md && \
    set +a

ENV NODE_OPTIONS="--max-old-space-size=4096"
RUN yarn build

# Feature reporter build
COPY --from=deps /feature-reporter/node_modules ./deploy/tools/feature-reporter/node_modules
RUN cd ./deploy/tools/feature-reporter && yarn compile_config && yarn build

# Env validator build
COPY --from=deps /envs-validator/node_modules ./deploy/tools/envs-validator/node_modules
RUN cd ./deploy/tools/envs-validator && yarn build

# Multichain config generator build
COPY --from=deps /multichain-config-generator/node_modules ./deploy/tools/multichain-config-generator/node_modules
RUN cd ./deploy/tools/multichain-config-generator && yarn build

# *****************************
# ******* STAGE 3: Run ********
# *****************************
FROM node:22.11.0-alpine AS runner
RUN apk add --no-cache --upgrade bash curl jq unzip

WORKDIR /app
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Prepare .next folder
RUN mkdir .next && chown nextjs:nodejs .next

# Copy app files
COPY --from=builder /app/next.config.js ./
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./

# Copy tools
COPY --from=builder /app/deploy/tools/envs-validator/index.js ./envs-validator.js
COPY --from=builder /app/deploy/tools/feature-reporter/index.js ./feature-reporter.js
COPY --from=builder /app/deploy/tools/multichain-config-generator/dist ./deploy/tools/multichain-config-generator/dist

# Copy scripts and set executable
COPY ./deploy/scripts/entrypoint.sh ./
COPY ./deploy/scripts/validate_envs.sh ./
COPY ./deploy/scripts/make_envs_script.sh ./
COPY ./deploy/scripts/download_assets.sh ./
COPY ./deploy/scripts/favicon_generator.sh ./
COPY ./deploy/scripts/sitemap_generator.sh ./
COPY ./deploy/scripts/og_image_generator.js ./

RUN chmod +x entrypoint.sh \
    && chmod +x validate_envs.sh \
    && chmod +x make_envs_script.sh \
    && chmod +x download_assets.sh \
    && chmod +x favicon_generator.sh \
    && chmod +x sitemap_generator.sh

# Copy tools directories
COPY --from=builder /app/deploy/tools/favicon-generator ./deploy/tools/favicon-generator
COPY --from=builder /app/deploy/tools/sitemap-generator ./deploy/tools/sitemap-generator
RUN chmod -R 777 ./deploy/tools/favicon-generator ./deploy/tools/sitemap-generator ./public

# Copy ENVs
COPY --from=builder /app/.env.registry ./
COPY --from=builder /app/.env ./
ARG ENVS_PRESET
ENV ENVS_PRESET=$ENVS_PRESET
COPY ./configs/envs ./configs/envs

# Next.js output
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

ENTRYPOINT ["./entrypoint.sh"]

USER nextjs

EXPOSE 3000
ENV PORT 3000

CMD ["node", "server.js"]
