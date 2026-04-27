# Frontend Refactor Plan: API Response Standardization

This document outlines the necessary changes to the frontend to support the standardized API response format from the NestJS backend.

## 1. Goal
Transition from receiving raw data directly to a consistent response wrapper. This allows for better error handling, consistent metadata (pagination, unread counts), and standard timestamps for all requests.

## 2. Standardized Response Format
When enabled, all API responses will follow this shape:

```json
{
  "data": T,              // The actual payload (array, object, etc.)
  "statusCode": number,   // HTTP status code (200, 201, etc.)
  "timestamp": "string"   // ISO timestamp of the response
}
```

## 3. Current Bloackers
The following errors were observed when the standardization was enabled:
- `TypeError: data.reduce is not a function`: Occurs because code expects `data` to be an array, but it's now an object containing the array.
- `Cannot read properties of undefined (reading 'unreadCount')`: Occurs because `meta` or data objects are nested deeper than expected.

## 4. Required Changes

### A. Centralized Fetch Interceptor/Wrapper
If using `axios` or a custom fetch wrapper, update the response interceptor to automatically extract the `.data` property.

**Axios Example:**
```typescript
api.interceptors.response.use(
  (response) => {
    // If the response follows the standard format, extract the inner data
    if (response.data && 'data' in response.data && 'statusCode' in response.data) {
      return response.data.data;
    }
    return response.data;
  },
  (error) => Promise.reject(error)
);
```

### B. Updating Manual Fetch Calls
For manual fetch calls, modify the JSON parsing logic:

```diff
- const blogs = await fetch('/api/blogs').then(r => r.json());
+ const res = await fetch('/api/blogs').then(r => r.json());
+ const blogs = res.data;
```

### C. Handling Metadata
Standardized responses for lists often include a `meta` property alongside `data`.

```json
{
  "data": [...],
  "meta": {
     "total": 100,
     "page": 1,
     "unreadCount": 5
  }
}
```

Frontend logic should be updated to handle this split:
```typescript
const { data: posts, meta } = await blogService.getPosts();
setTotalPages(meta.lastPage);
```

### D. Content Security Policy (CSP)
Review the `next.config.js` or middleware to ensure `static.cloudflareinsights.com` is whitelisted in `script-src` and `connect-src` if using Cloudflare analytics.

## 5. Deployment Strategy
1. **Prepare Frontend**: Update the API service layer to be "wrapper-aware".
2. **Enable Backend Interceptor**: Re-enable `TransformInterceptor` in `AppModule`.
3. **Verify**: Ensure critical paths like Blog lists, Notifications, and Admin dash function correctly.
