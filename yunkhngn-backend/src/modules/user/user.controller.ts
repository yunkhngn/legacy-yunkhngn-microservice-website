import {
  Controller,
  Get,
  Patch,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiBody } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { UserService } from './user.service';

interface RequestWithUser extends Request {
  user: {
    uid: string;
    email: string;
  };
}

@ApiTags('User')
@Controller('user')
export class UserController {
  private readonly logger = new Logger(UserController.name);
  constructor(private readonly userService: UserService) {}

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile' })
  @UseGuards(AuthGuard('firebase'))
  async getProfile(@Request() req: RequestWithUser) {
    const uid = req.user.uid;
    const user = await this.userService.findByUid(uid);
    if (!user) {
      return { uid, email: req.user.email };
    }
    return user;
  }

  @Patch('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update current user profile' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: { name: { type: 'string' }, avatarUrl: { type: 'string' } },
    },
  })
  @UseGuards(AuthGuard('firebase'))
  async updateProfile(
    @Request() req: RequestWithUser,
    @Body() body: { name?: string; avatarUrl?: string },
  ) {
    this.logger.log(`Updating profile for user: ${req.user.uid}`);
    const uid = req.user.uid;
    const email = req.user.email;
    return this.userService.createOrUpdate(
      uid,
      email,
      body.avatarUrl,
      body.name,
    );
  }

  @Get()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all users (Admin/Staff only)' })
  @UseGuards(AuthGuard('firebase'))
  findAll() {
    return this.userService.findAll();
  }

  @Post()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new user' })
  @UseGuards(AuthGuard('firebase'))
  create(
    @Body()
    body: {
      email: string;
      password?: string;
      name?: string;
      role?: string;
    },
  ) {
    return this.userService.create(
      body.email,
      body.password,
      body.name,
      body.role,
    );
  }

  @Patch(':uid')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update any user profile' })
  @UseGuards(AuthGuard('firebase'))
  update(
    @Param('uid') uid: string,
    @Body() body: { name?: string; role?: string; password?: string },
  ) {
    return this.userService.update(uid, body);
  }

  @Delete(':uid')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a user' })
  @UseGuards(AuthGuard('firebase'))
  remove(@Param('uid') uid: string) {
    return this.userService.delete(uid);
  }
}
