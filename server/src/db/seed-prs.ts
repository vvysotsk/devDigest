/**
 * Seed fixtures for the L02 control experiment (specs/L02-skills.md, D8): two
 * pull requests on the demo repo `acme/payments-api`. The repo has no clone
 * (`clone_path = null`), so a review builds its diff from these `patch`
 * strings (GitHub `pr_files.patch` format: hunks only, no file headers).
 *
 * Plain data only — `seed.ts` owns the DB writes. Per file, `additions` /
 * `deletions` equal the `+` / `-` lines of its patch.
 */

export interface SeedPrFile {
  path: string;
  additions: number;
  deletions: number;
  patch: string;
}

export interface SeedPrCommit {
  sha: string;
  message: string;
  author: string;
}

export interface SeedPr {
  number: number;
  title: string;
  author: string;
  branch: string;
  base: string;
  headSha: string;
  body: string;
  files: SeedPrFile[];
  commits: SeedPrCommit[];
}

export const SEED_PR_REPO = 'acme/payments-api';

export const SEED_EXPERIMENT_PRS: readonly SeedPr[] = [
  {
    number: 483,
    title: 'Add coupon discount calculation',
    author: 'dana.okafor',
    branch: 'feat/coupon-discounts',
    base: 'main',
    headSha: 'b7e41c9a20d3',
    body:
      'Adds `applyCoupon`, which computes the discount for a coupon at checkout. ' +
      'Percent coupons can carry an optional cap (`maxDiscountCents`); fixed coupons ' +
      'subtract a flat amount. Expired coupons and empty orders are not discounted, and ' +
      'the discount never exceeds the subtotal. Unit tests are in `test/billing/discount.test.ts`.',
    files: [
      {
        path: 'src/billing/discount.ts',
        additions: 64,
        deletions: 0,
        patch: `@@ -0,0 +1,64 @@
+export type Coupon =
+  | {
+      code: string;
+      kind: 'percent';
+      /** 1–100. */
+      percent: number;
+      /** Upper bound for the discount, in cents. */
+      maxDiscountCents?: number;
+      expiresAt?: Date;
+    }
+  | {
+      code: string;
+      kind: 'fixed';
+      amountCents: number;
+      expiresAt?: Date;
+    };
+
+export type CouponRejection = 'expired' | 'empty_total';
+
+export interface DiscountResult {
+  applied: boolean;
+  discountCents: number;
+  totalCents: number;
+  rejection?: CouponRejection;
+}
+
+/**
+ * Applies a coupon to an order subtotal. All amounts are integer cents.
+ * The discount never exceeds the subtotal, so the total never goes below zero.
+ */
+export function applyCoupon(
+  subtotalCents: number,
+  coupon: Coupon,
+  now: Date = new Date(),
+): DiscountResult {
+  if (subtotalCents <= 0) {
+    return {
+      applied: false,
+      discountCents: 0,
+      totalCents: Math.max(subtotalCents, 0),
+      rejection: 'empty_total',
+    };
+  }
+
+  if (coupon.expiresAt && coupon.expiresAt.getTime() <= now.getTime()) {
+    return { applied: false, discountCents: 0, totalCents: subtotalCents, rejection: 'expired' };
+  }
+
+  let discountCents: number;
+  if (coupon.kind === 'percent') {
+    discountCents = Math.round((subtotalCents * coupon.percent) / 100);
+    if (coupon.maxDiscountCents !== undefined && discountCents > coupon.maxDiscountCents) {
+      discountCents = coupon.maxDiscountCents;
+    }
+  } else {
+    discountCents = coupon.amountCents;
+  }
+
+  if (discountCents > subtotalCents) {
+    discountCents = subtotalCents;
+  }
+
+  return { applied: true, discountCents, totalCents: subtotalCents - discountCents };
+}`,
      },
      {
        path: 'test/billing/discount.test.ts',
        additions: 17,
        deletions: 0,
        patch: `@@ -0,0 +1,17 @@
+import { describe, expect, it } from 'vitest';
+import { applyCoupon } from '../../src/billing/discount.js';
+
+describe('applyCoupon', () => {
+  it('applies a percent coupon to the subtotal', () => {
+    const result = applyCoupon(10_000, { code: 'SPRING10', kind: 'percent', percent: 10 });
+
+    expect(result).toEqual({ applied: true, discountCents: 1_000, totalCents: 9_000 });
+  });
+
+  it('rounds the percent discount to whole cents', () => {
+    const result = applyCoupon(1_999, { code: 'WELCOME15', kind: 'percent', percent: 15 });
+
+    expect(result.discountCents).toBe(300);
+    expect(result.totalCents).toBe(1_699);
+  });
+});`,
      },
    ],
    commits: [
      {
        sha: '4f0d2a61c8b5',
        message: 'feat(billing): add applyCoupon for percent and fixed coupons',
        author: 'dana.okafor',
      },
      {
        sha: 'b7e41c9a20d3',
        message: 'test(billing): add applyCoupon unit tests',
        author: 'dana.okafor',
      },
    ],
  },
  {
    number: 484,
    title: 'Page through GET /users with a cursor',
    author: 'tomas.lindqvist',
    branch: 'feat/users-keyset-paging',
    base: 'main',
    headSha: 'e93a5f07b1c4',
    body:
      'The user list returned up to `limit` rows with no way to fetch the rest. ' +
      'This switches `GET /users` to keyset paging ordered by id: the response now ' +
      'carries `items` and `next_cursor` (null on the last page), `page_size` sets the ' +
      'page length (default 50, max 100), and `cursor` continues from the previous page.',
    files: [
      {
        path: 'src/api/users.ts',
        additions: 25,
        deletions: 6,
        patch: `@@ -1,6 +1,6 @@
 import type { FastifyInstance } from 'fastify';
 import type { ZodTypeProvider } from 'fastify-type-provider-zod';
-import { asc, eq, ilike } from 'drizzle-orm';
+import { and, asc, eq, gt, ilike } from 'drizzle-orm';
 import { users } from '../db/schema.js';
 import { ListUsersQuery, ListUsersResponse } from '../schemas/users.js';
 import { toUserSummary } from './users.mapper.js';
@@ -17,14 +17,25 @@
       },
     },
     async (req) => {
-      const { limit, email } = req.query;
+      const { page_size, cursor, email } = req.query;
       const rows = await app.db
         .select()
         .from(users)
-        .where(email ? ilike(users.email, \`%\${email}%\`) : undefined)
-        .orderBy(asc(users.createdAt))
-        .limit(limit);
-      return rows.map(toUserSummary);
+        .where(
+          and(
+            email ? ilike(users.email, \`%\${email}%\`) : undefined,
+            cursor ? gt(users.id, decodeCursor(cursor)) : undefined,
+          ),
+        )
+        .orderBy(asc(users.id))
+        .limit(page_size + 1);
+
+      const hasMore = rows.length > page_size;
+      const page = hasMore ? rows.slice(0, page_size) : rows;
+      return {
+        items: page.map(toUserSummary),
+        next_cursor: hasMore ? encodeCursor(page[page.length - 1]!.id) : null,
+      };
     },
   );
 
@@ -35,3 +46,11 @@
     return toUserSummary(row);
   });
 }
+
+function encodeCursor(id: string): string {
+  return Buffer.from(id, 'utf8').toString('base64url');
+}
+
+function decodeCursor(cursor: string): string {
+  return Buffer.from(cursor, 'base64url').toString('utf8');
+}`,
      },
      {
        path: 'src/schemas/users.ts',
        additions: 6,
        deletions: 2,
        patch: `@@ -9,10 +9,14 @@
 export type UserSummary = z.infer<typeof UserSummary>;
 
 export const ListUsersQuery = z.object({
-  limit: z.coerce.number().int().min(1).max(100).default(50),
+  page_size: z.coerce.number().int().min(1).max(100).default(50),
+  cursor: z.string().optional(),
   email: z.string().optional(),
 });
 export type ListUsersQuery = z.infer<typeof ListUsersQuery>;
 
-export const ListUsersResponse = z.array(UserSummary);
+export const ListUsersResponse = z.object({
+  items: z.array(UserSummary),
+  next_cursor: z.string().nullable(),
+});
 export type ListUsersResponse = z.infer<typeof ListUsersResponse>;`,
      },
    ],
    commits: [
      {
        sha: 'e93a5f07b1c4',
        message: 'feat(api): keyset paging for GET /users',
        author: 'tomas.lindqvist',
      },
    ],
  },
];
